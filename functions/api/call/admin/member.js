import { callError } from '../_shared.js';
import {
  adminErrorResponse,
  adminJson,
  adminOptions,
  maskEmail,
  maskPhone,
  ownerIdInput,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';

const CALLTAG_PRODUCTS_SQL = "'call_monthly','message_monthly','all_monthly'";

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });

  try {
    if (!env.DB?.prepare) return adminJson(503, { ok: false, error: '관리자 저장소가 연결되지 않았습니다.', code: 'CALLTAG_ADMIN_DB_REQUIRED' });
    const identity = await requireCalltagAdmin(request, env);
    const ownerId = ownerIdInput(new URL(request.url).searchParams.get('ownerId') || '');

    const profile = await env.DB.prepare(`
      SELECT owner_id, email, phone, created_at, updated_at
      FROM calllink_profiles
      WHERE owner_id = ?
      LIMIT 1
    `).bind(ownerId).first();
    if (!profile?.owner_id) {
      throw callError('회원을 찾을 수 없습니다.', 404, { code: 'CALLTAG_ADMIN_MEMBER_NOT_FOUND' });
    }

    const [billingAccount, subscriptions, referral, partner] = await Promise.all([
      firstSafe(env.DB, `
        SELECT trial_started_at, trial_ends_at, referral_bonus_days
        FROM billing_accounts
        WHERE owner_id = ?
        LIMIT 1
      `, [ownerId]),
      allSafe(env.DB, `
        SELECT product_code, channel, status, started_at, next_billing_at, expires_at,
               auto_renewing, verification_state, last_verified_at
        FROM billing_subscriptions
        WHERE owner_id = ?
          AND product_code IN (${CALLTAG_PRODUCTS_SQL})
        ORDER BY datetime(updated_at) DESC, id DESC
        LIMIT 20
      `, [ownerId]),
      firstSafe(env.DB, `
        SELECT
          (SELECT COUNT(*) FROM referrals r WHERE r.referrer_owner_id = ?) AS referred_count,
          (SELECT COUNT(*) FROM referrals r WHERE r.referred_owner_id = ?) AS was_referred
      `, [ownerId, ownerId]),
      firstSafe(env.DB, `
        SELECT
          COUNT(*) AS commission_count,
          COALESCE(SUM(CASE WHEN pc.status IN ('estimated','confirmed') THEN pc.commission_amount_krw ELSE 0 END), 0) AS pending_amount_krw,
          COALESCE(SUM(CASE WHEN pc.status = 'confirmed' THEN pc.commission_amount_krw ELSE 0 END), 0) AS confirmed_amount_krw
        FROM partner_commissions pc
        JOIN billing_subscriptions s ON s.id = pc.subscription_id
        WHERE pc.referrer_owner_id = ?
          AND s.product_code IN (${CALLTAG_PRODUCTS_SQL})
      `, [ownerId]),
    ]);

    await recordAdminAudit(env.DB, request, env, identity, 'member.read', ownerId);

    return adminJson(200, {
      ok: true,
      readOnly: true,
      member: {
        ownerId: String(profile.owner_id || '').slice(0, 120),
        email: maskEmail(profile.email),
        phone: maskPhone(profile.phone),
        createdAt: safeIso(profile.created_at),
        updatedAt: safeIso(profile.updated_at),
      },
      trial: billingAccount ? {
        startedAt: safeIso(billingAccount.trial_started_at),
        endsAt: safeIso(billingAccount.trial_ends_at),
        referralBonusDays: clampNumber(billingAccount.referral_bonus_days, 0, 31),
      } : null,
      subscriptions: subscriptions.map((row) => ({
        productCode: String(row.product_code || '').slice(0, 80),
        channel: String(row.channel || '').slice(0, 32),
        status: String(row.status || '').slice(0, 32),
        startedAt: safeIso(row.started_at),
        nextBillingAt: safeIso(row.next_billing_at),
        expiresAt: safeIso(row.expires_at),
        autoRenewing: Number(row.auto_renewing || 0) === 1,
        verificationState: String(row.verification_state || '').slice(0, 32),
        lastVerifiedAt: safeIso(row.last_verified_at),
      })),
      referral: {
        referredCount: clampNumber(referral?.referred_count, 0, 1_000_000),
        wasReferred: Number(referral?.was_referred || 0) > 0,
      },
      partner: {
        commissionCount: clampNumber(partner?.commission_count, 0, 1_000_000),
        pendingAmountKrw: clampNumber(partner?.pending_amount_krw, 0, Number.MAX_SAFE_INTEGER),
        confirmedAmountKrw: clampNumber(partner?.confirmed_amount_krw, 0, Number.MAX_SAFE_INTEGER),
      },
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

async function firstSafe(db, sql, bindings = []) {
  try {
    return await db.prepare(sql).bind(...bindings).first();
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

async function allSafe(db, sql, bindings = []) {
  try {
    const result = await db.prepare(sql).bind(...bindings).all();
    return Array.isArray(result?.results) ? result.results : [];
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

function isMissingTable(error) {
  return String(error?.message || '').toLowerCase().includes('no such table');
}

function safeIso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function clampNumber(value, min, max) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
