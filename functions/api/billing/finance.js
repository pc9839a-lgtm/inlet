import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../_shared.js';
import { getSessionAccount } from '../auth/_auth.js';
import { ensureBillingSchema } from './_shared.js';

const METHODS = 'GET, OPTIONS';
const DAY_MS = 24 * 60 * 60 * 1000;
let schemaReadyPromise = null;

function ensureSchemaOnce(db) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureBillingSchema(db).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function iso(value = '') {
  const raw = text(value, 100);
  if (!raw) return '';
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : raw;
}

function normalizeSubscriptionState(value = '') {
  const state = text(value, 40).toLowerCase();
  return ['pending', 'active', 'grace', 'cancelled', 'expired', 'suspended', 'refunded'].includes(state)
    ? state
    : 'pending';
}

function subscriptionPublic(row = {}) {
  return {
    id: Number(row.id || 0),
    productCode: text(row.product_code, 120),
    channel: text(row.channel, 40),
    status: normalizeSubscriptionState(row.status),
    externalSubscriptionId: text(row.external_subscription_id, 240),
    orderId: text(row.order_id, 240),
    startsAt: iso(row.started_at),
    nextBillingAt: iso(row.next_billing_at),
    expiresAt: iso(row.expires_at),
    autoRenewing: Number(row.auto_renewing || 0) === 1,
    verificationState: text(row.verification_state, 40),
    lastVerifiedAt: iso(row.last_verified_at),
    updatedAt: iso(row.updated_at),
  };
}

function firstRow(result) {
  return Array.isArray(result?.results) ? (result.results[0] || null) : null;
}

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function remainingDays(value = '') {
  const end = Date.parse(String(value || ''));
  if (!Number.isFinite(end) || end <= Date.now()) return 0;
  return Math.ceil((end - Date.now()) / DAY_MS);
}

function randomReferralCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  let value = '';
  for (const byte of bytes) value += alphabet[byte % alphabet.length];
  return value;
}

async function ensureBillingAccountFast(db, ownerId) {
  let account = await db.prepare(`
    SELECT owner_id, trial_started_at, trial_ends_at, referral_bonus_days
    FROM billing_accounts
    WHERE owner_id = ?
    LIMIT 1
  `).bind(ownerId).first();
  if (account) return account;

  const now = new Date();
  const trialEnds = new Date(now.getTime() + (3 * DAY_MS));
  await db.prepare(`
    INSERT OR IGNORE INTO billing_accounts (
      owner_id, trial_started_at, trial_ends_at, referral_bonus_days, created_at, updated_at
    ) VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(ownerId, now.toISOString(), trialEnds.toISOString()).run();

  account = await db.prepare(`
    SELECT owner_id, trial_started_at, trial_ends_at, referral_bonus_days
    FROM billing_accounts
    WHERE owner_id = ?
    LIMIT 1
  `).bind(ownerId).first();
  return account || {
    owner_id: ownerId,
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnds.toISOString(),
    referral_bonus_days: 0,
  };
}

async function ensureReferralCodeFast(db, ownerId, existingCode = '') {
  const current = text(existingCode, 20).toUpperCase();
  if (current) return current;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomReferralCode();
    try {
      await db.prepare(`
        INSERT INTO referral_codes (owner_id, code, created_at, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(ownerId, code).run();
      return code;
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('unique')) {
        const existing = await db.prepare('SELECT code FROM referral_codes WHERE owner_id = ? LIMIT 1')
          .bind(ownerId).first();
        if (existing?.code) return text(existing.code, 20).toUpperCase();
        continue;
      }
      throw error;
    }
  }
  return '';
}

function entitlementFrom(account = {}, subscriptions = []) {
  const active = subscriptions.filter((item) => {
    if (!['active', 'grace', 'cancelled'].includes(item.status)) return false;
    if (!['all_monthly', 'call_monthly', 'message_monthly'].includes(item.productCode)) return false;
    const expiresAt = Date.parse(String(item.expiresAt || ''));
    return !Number.isFinite(expiresAt) || expiresAt > Date.now();
  });
  const priority = ['all_monthly', 'call_monthly', 'message_monthly'];
  const selected = priority.map((code) => active.find((item) => item.productCode === code)).find(Boolean) || null;
  const trialStartedAt = iso(account.trial_started_at);
  const trialEndsAt = iso(account.trial_ends_at);
  const trialRemaining = remainingDays(trialEndsAt);
  const trialActive = !selected && trialRemaining > 0;
  const productCode = selected?.productCode || 'all_monthly';
  const channel = selected?.channel || 'none';
  const status = selected ? selected.status : (trialActive ? 'trial' : 'inactive');
  return {
    active: !!selected || trialActive,
    status,
    productCode,
    plan: productCode,
    scope: productCode === 'call_monthly' ? 'call' : productCode === 'message_monthly' ? 'message' : 'all',
    channel,
    billingSource: channel,
    source: selected ? channel : 'trial',
    startsAt: selected ? selected.startsAt : trialStartedAt,
    endsAt: selected ? selected.expiresAt : trialEndsAt,
    expiresAt: selected ? selected.expiresAt : trialEndsAt,
    nextBillingAt: selected ? selected.nextBillingAt : '',
    remainingDays: selected ? remainingDays(selected.expiresAt) : trialRemaining,
    purchaseBlocked: !!selected,
    purchaseBlockReason: selected ? (channel === 'web' ? 'WEB_SUBSCRIPTION_ACTIVE' : 'ACTIVE_SUBSCRIPTION_EXISTS') : '',
    trial: {
      active: trialActive,
      scope: 'all',
      baseDays: 3,
      referralBonusDays: Number(account.referral_bonus_days || 0),
      startsAt: trialStartedAt,
      endsAt: trialEndsAt,
      remainingDays: trialRemaining,
    },
    subscription: selected,
  };
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    const { user } = await getSessionAccount(request, env);
    const ownerId = text(user?.ownerId || user?.id, 120);
    if (!ownerId) throw new Error('로그인 계정을 확인할 수 없습니다.');

    await ensureSchemaOnce(db);
    const account = await ensureBillingAccountFast(db, ownerId);
    const month = new Date().toISOString().slice(0, 7);

    const [subscriptionsResult, referralCodeResult, appliedResult, countsResult, revenueResult] = await db.batch([
      db.prepare(`
        SELECT id, owner_id, product_code, channel, status, external_subscription_id,
               order_id, started_at, next_billing_at, expires_at, auto_renewing,
               verification_state, last_verified_at, created_at, updated_at
        FROM billing_subscriptions
        WHERE owner_id = ?
        ORDER BY updated_at DESC, id DESC
        LIMIT 50
      `).bind(ownerId),
      db.prepare('SELECT code, created_at, updated_at FROM referral_codes WHERE owner_id = ? LIMIT 1').bind(ownerId),
      db.prepare(`
        SELECT referral_code, bonus_days, status, applied_at
        FROM referrals
        WHERE referred_owner_id = ?
        LIMIT 1
      `).bind(ownerId),
      db.prepare(`
        SELECT
          COUNT(DISTINCT r.id) AS referred_count,
          COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN r.referred_owner_id END) AS active_paid_count
        FROM referrals r
        LEFT JOIN billing_subscriptions s
          ON s.owner_id = r.referred_owner_id
         AND s.verification_state = 'verified'
         AND s.status IN ('active', 'grace', 'cancelled')
         AND (s.expires_at = '' OR julianday(s.expires_at) > julianday('now'))
        WHERE r.referrer_owner_id = ?
      `).bind(ownerId),
      db.prepare(`
        SELECT
          SUM(CASE WHEN earned_month = ? AND status IN ('estimated', 'confirmed')
            THEN commission_amount_krw ELSE 0 END) AS estimated_revenue,
          SUM(CASE WHEN status = 'confirmed'
            THEN commission_amount_krw ELSE 0 END) AS confirmed_revenue
        FROM partner_commissions
        WHERE referrer_owner_id = ?
      `).bind(month, ownerId),
    ]);

    const subscriptions = rows(subscriptionsResult).map(subscriptionPublic);
    const referralCodeRow = firstRow(referralCodeResult) || {};
    const code = await ensureReferralCodeFast(db, ownerId, referralCodeRow.code);
    const applied = firstRow(appliedResult) || null;
    const counts = firstRow(countsResult) || {};
    const revenue = firstRow(revenueResult) || {};
    const shareUrl = code ? `https://pagero.kr/r/${encodeURIComponent(code)}` : '';

    return jsonResponse(request, env, 200, {
      ok: true,
      subscriptions,
      entitlement: entitlementFrom(account, subscriptions),
      referral: {
        mine: { code, shareUrl, createdAt: iso(referralCodeRow.created_at) },
        code,
        shareUrl,
        applied: !!applied,
        appliedCode: text(applied?.referral_code, 20),
        bonusDays: Number(applied?.bonus_days || 0),
        appliedAt: iso(applied?.applied_at),
      },
      summary: {
        referredCount: Number(counts.referred_count || 0),
        activePaidCount: Number(counts.active_paid_count || 0),
        estimatedRevenueKrw: Number(revenue.estimated_revenue || 0),
        confirmedRevenueKrw: Number(revenue.confirmed_revenue || 0),
        partnerCenterAvailable: false,
        partnerCenterUrl: '',
      },
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
