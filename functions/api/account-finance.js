import {
  apiTokenAuthorized,
  assertD1,
  jsonResponse,
  optionsResponse,
  readJson,
  sessionIdentity,
} from './_shared.js';

const METHODS = 'GET, POST, OPTIONS';
const SERVICES = new Set(['pagero', 'calltag']);
const PRICING = Object.freeze({
  pagero: [
    { code: 'free', name: '무료', amountKrw: 0, description: '공개 페이지 1개' },
    { code: 'starter', name: '스타터', amountKrw: 3500, description: '페이지 운영과 접수 관리' },
    { code: 'pro', name: '프로', amountKrw: 9900, description: '고급 연동과 확장 기능' },
  ],
  calltag: [
    { code: 'free', name: '무료 체험', amountKrw: 0, description: '3일 무료 체험' },
    { code: 'classic', name: '클래식', amountKrw: 3500, description: '통화 후 고객관리' },
    { code: 'pro', name: '프로', amountKrw: 5500, description: '문자 자동화와 확장 기능' },
  ],
});

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeService(value = '') {
  const service = String(value || '').trim().toLowerCase();
  return SERVICES.has(service) ? service : '';
}

function normalizeCode(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

function stableHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0');
}

function referralCodeFor(account = {}) {
  return `PG${stableHash(`${account.id}:${normalizeEmail(account.email)}`)}`.slice(0, 10);
}

function makeId(prefix = 'finance') {
  const random = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

function errorWithStatus(message, status = 400, code = '') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function ensureFinanceSchema(db) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS account_finance_profiles (
      account_id TEXT PRIMARY KEY,
      email TEXT NOT NULL DEFAULT '',
      referral_code TEXT NOT NULL UNIQUE,
      referred_by_account_id TEXT,
      trial_bonus_days INTEGER NOT NULL DEFAULT 0,
      payout_status TEXT NOT NULL DEFAULT 'unregistered',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_account_finance_profiles_email
      ON account_finance_profiles(lower(email))`,
    `CREATE TABLE IF NOT EXISTS account_subscriptions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      service TEXT NOT NULL,
      plan_code TEXT NOT NULL DEFAULT 'free',
      plan_name TEXT NOT NULL DEFAULT '',
      amount_krw INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'inactive',
      provider TEXT NOT NULL DEFAULT '',
      provider_subscription_id TEXT NOT NULL DEFAULT '',
      current_period_start TEXT NOT NULL DEFAULT '',
      current_period_end TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (account_id, service)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_account_subscriptions_account
      ON account_subscriptions(account_id, service, status)`,
    `CREATE TABLE IF NOT EXISTS account_referrals (
      id TEXT PRIMARY KEY,
      referrer_account_id TEXT NOT NULL,
      referred_account_id TEXT NOT NULL UNIQUE,
      referral_code TEXT NOT NULL,
      commission_rate_bps INTEGER NOT NULL DEFAULT 2000,
      bonus_days INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'active',
      registered_at TEXT NOT NULL,
      qualified_at TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE INDEX IF NOT EXISTS idx_account_referrals_referrer
      ON account_referrals(referrer_account_id, status, registered_at)`,
    `CREATE TABLE IF NOT EXISTS account_finance_ledger (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      service TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      amount_krw INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      related_account_id TEXT NOT NULL DEFAULT '',
      provider_ref TEXT NOT NULL DEFAULT '',
      occurred_at TEXT NOT NULL,
      available_at TEXT NOT NULL DEFAULT '',
      paid_at TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_account_finance_ledger_account
      ON account_finance_ledger(account_id, status, occurred_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_account_finance_ledger_provider_ref
      ON account_finance_ledger(provider_ref, entry_type, service)`,
  ];
  for (const sql of statements) await db.prepare(sql).run();
}

async function accountForIdentity(db, identity = {}) {
  const ownerId = String(identity.ownerId || '').trim();
  const email = normalizeEmail(identity.email);
  if (!ownerId && !email) throw errorWithStatus('로그인 계정을 확인할 수 없습니다.', 401, 'ACCOUNT_IDENTITY_REQUIRED');

  const row = await db.prepare(`
    SELECT id, email, name, status
    FROM accounts
    WHERE (? <> '' AND id = ?)
       OR (? <> '' AND lower(email) = ?)
    ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
    LIMIT 1
  `).bind(ownerId, ownerId, email, email, ownerId).first();

  if (!row?.id) throw errorWithStatus('계정 정보를 찾을 수 없습니다.', 404, 'ACCOUNT_NOT_FOUND');
  if (String(row.status || 'active') !== 'active') throw errorWithStatus('사용할 수 없는 계정입니다.', 403, 'ACCOUNT_NOT_ACTIVE');
  return { id: String(row.id), email: normalizeEmail(row.email || email), name: String(row.name || '') };
}

async function accountForInternalRequest(db, body = {}) {
  const accountId = String(body.accountId || '').trim();
  const email = normalizeEmail(body.email);
  if (!accountId && !email) throw errorWithStatus('accountId 또는 email이 필요합니다.', 400, 'ACCOUNT_LOOKUP_REQUIRED');
  const row = await db.prepare(`
    SELECT id, email, name, status
    FROM accounts
    WHERE (? <> '' AND id = ?)
       OR (? <> '' AND lower(email) = ?)
    ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
    LIMIT 1
  `).bind(accountId, accountId, email, email, accountId).first();
  if (!row?.id) throw errorWithStatus('계정 정보를 찾을 수 없습니다.', 404, 'ACCOUNT_NOT_FOUND');
  return { id: String(row.id), email: normalizeEmail(row.email || email), name: String(row.name || '') };
}

async function ensureProfile(db, account = {}) {
  const existing = await db.prepare(`
    SELECT * FROM account_finance_profiles WHERE account_id = ? LIMIT 1
  `).bind(account.id).first();
  const now = nowIso();
  if (!existing) {
    let referralCode = referralCodeFor(account);
    const collision = await db.prepare('SELECT account_id FROM account_finance_profiles WHERE referral_code = ? LIMIT 1').bind(referralCode).first();
    if (collision?.account_id && String(collision.account_id) !== account.id) {
      referralCode = `PG${stableHash(`${account.id}:${account.email}:${now}`)}`.slice(0, 10);
    }
    await db.prepare(`
      INSERT INTO account_finance_profiles (
        account_id, email, referral_code, referred_by_account_id,
        trial_bonus_days, payout_status, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, 0, 'unregistered', ?, ?)
    `).bind(account.id, account.email, referralCode, now, now).run();
  } else if (normalizeEmail(existing.email) !== account.email) {
    await db.prepare('UPDATE account_finance_profiles SET email = ?, updated_at = ? WHERE account_id = ?')
      .bind(account.email, now, account.id).run();
  }
  return db.prepare('SELECT * FROM account_finance_profiles WHERE account_id = ? LIMIT 1').bind(account.id).first();
}

function planByCode(service, code) {
  return (PRICING[service] || []).find((plan) => plan.code === code) || null;
}

async function ensureDefaultSubscriptions(db, account = {}) {
  const now = nowIso();
  for (const service of SERVICES) {
    const plan = PRICING[service][0];
    await db.prepare(`
      INSERT OR IGNORE INTO account_subscriptions (
        id, account_id, service, plan_code, plan_name, amount_krw, status,
        provider, provider_subscription_id, current_period_start, current_period_end,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'inactive', '', '', '', '', ?, ?)
    `).bind(makeId('sub'), account.id, service, plan.code, plan.name, plan.amountKrw, now, now).run();
  }
}

async function settlementSnapshot(db, accountId) {
  const rows = await db.prepare(`
    SELECT service,
      COALESCE(SUM(CASE WHEN entry_type = 'commission' AND status <> 'cancelled' THEN amount_krw ELSE 0 END), 0) AS earned,
      COALESCE(SUM(CASE WHEN entry_type = 'commission' AND status = 'pending' THEN amount_krw ELSE 0 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN entry_type = 'commission' AND status = 'available' THEN amount_krw ELSE 0 END), 0) AS available,
      COALESCE(SUM(CASE WHEN entry_type = 'payout' AND status = 'paid' THEN amount_krw ELSE 0 END), 0) AS paid
    FROM account_finance_ledger
    WHERE account_id = ?
    GROUP BY service
  `).bind(accountId).all();

  const byService = { pagero: { earned: 0, pending: 0, available: 0, paid: 0 }, calltag: { earned: 0, pending: 0, available: 0, paid: 0 } };
  for (const row of rows.results || []) {
    if (!byService[row.service]) continue;
    byService[row.service] = {
      earned: Number(row.earned || 0),
      pending: Number(row.pending || 0),
      available: Number(row.available || 0),
      paid: Number(row.paid || 0),
    };
  }
  const combined = Object.values(byService).reduce((sum, current) => ({
    earned: sum.earned + current.earned,
    pending: sum.pending + current.pending,
    available: sum.available + current.available,
    paid: sum.paid + current.paid,
  }), { earned: 0, pending: 0, available: 0, paid: 0 });
  combined.balance = Math.max(0, combined.available - combined.paid);
  return { byService, combined };
}

async function financeSnapshot(db, account = {}) {
  const profile = await ensureProfile(db, account);
  await ensureDefaultSubscriptions(db, account);
  const subscriptions = await db.prepare(`
    SELECT service, plan_code AS planCode, plan_name AS planName, amount_krw AS amountKrw,
      status, provider, current_period_start AS currentPeriodStart,
      current_period_end AS currentPeriodEnd, updated_at AS updatedAt
    FROM account_subscriptions
    WHERE account_id = ?
    ORDER BY service
  `).bind(account.id).all();
  const referral = await db.prepare(`
    SELECT r.referral_code AS referralCode, r.bonus_days AS bonusDays,
      r.commission_rate_bps AS commissionRateBps, r.status, r.registered_at AS registeredAt,
      p.email AS referrerEmail
    FROM account_referrals r
    LEFT JOIN account_finance_profiles p ON p.account_id = r.referrer_account_id
    WHERE r.referred_account_id = ?
    LIMIT 1
  `).bind(account.id).first();
  const referralCount = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM account_referrals
    WHERE referrer_account_id = ? AND status = 'active'
  `).bind(account.id).first();
  const settlement = await settlementSnapshot(db, account.id);
  return {
    account: { id: account.id, email: account.email, name: account.name },
    pricing: PRICING,
    subscriptions: subscriptions.results || [],
    referral: {
      code: String(profile.referral_code || ''),
      registeredCode: String(referral?.referralCode || ''),
      referrerEmail: String(referral?.referrerEmail || ''),
      bonusDays: Number(profile.trial_bonus_days || referral?.bonusDays || 0),
      commissionRatePercent: 20,
      referralCount: Number(referralCount?.count || 0),
      locked: !!referral?.referralCode,
    },
    settlement,
    checkout: {
      pagero: '/subscribe?service=pagero',
      calltag: 'https://calltag.pagero.kr/subscribe',
    },
  };
}

async function applyReferral(db, account, code) {
  const referralCode = normalizeCode(code);
  if (!referralCode) throw errorWithStatus('추천인 코드를 입력해주세요.', 400, 'REFERRAL_CODE_REQUIRED');
  const profile = await ensureProfile(db, account);
  if (normalizeCode(profile.referral_code) === referralCode) {
    throw errorWithStatus('본인 추천인 코드는 등록할 수 없습니다.', 409, 'REFERRAL_SELF_NOT_ALLOWED');
  }
  const existing = await db.prepare('SELECT id FROM account_referrals WHERE referred_account_id = ? LIMIT 1').bind(account.id).first();
  if (existing?.id) throw errorWithStatus('추천인 코드는 한 번만 등록할 수 있습니다.', 409, 'REFERRAL_ALREADY_REGISTERED');
  const referrer = await db.prepare(`
    SELECT account_id, referral_code
    FROM account_finance_profiles
    WHERE referral_code = ?
    LIMIT 1
  `).bind(referralCode).first();
  if (!referrer?.account_id) throw errorWithStatus('유효하지 않은 추천인 코드입니다.', 404, 'REFERRAL_CODE_NOT_FOUND');

  const now = nowIso();
  await db.batch([
    db.prepare(`
      INSERT INTO account_referrals (
        id, referrer_account_id, referred_account_id, referral_code,
        commission_rate_bps, bonus_days, status, registered_at, qualified_at
      ) VALUES (?, ?, ?, ?, 2000, 5, 'active', ?, '')
    `).bind(makeId('ref'), referrer.account_id, account.id, referralCode, now),
    db.prepare(`
      UPDATE account_finance_profiles
      SET referred_by_account_id = ?, trial_bonus_days = CASE WHEN trial_bonus_days < 5 THEN 5 ELSE trial_bonus_days END,
          updated_at = ?
      WHERE account_id = ?
    `).bind(referrer.account_id, now, account.id),
  ]);
}

async function updateSubscription(db, account, body = {}) {
  const service = normalizeService(body.service);
  const plan = planByCode(service, String(body.planCode || '').trim().toLowerCase());
  if (!service || !plan) throw errorWithStatus('유효한 서비스와 요금제가 필요합니다.', 400, 'PLAN_INVALID');
  const status = String(body.status || 'active').trim().toLowerCase();
  const now = nowIso();
  await db.prepare(`
    INSERT INTO account_subscriptions (
      id, account_id, service, plan_code, plan_name, amount_krw, status,
      provider, provider_subscription_id, current_period_start, current_period_end,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, service) DO UPDATE SET
      plan_code = excluded.plan_code,
      plan_name = excluded.plan_name,
      amount_krw = excluded.amount_krw,
      status = excluded.status,
      provider = excluded.provider,
      provider_subscription_id = excluded.provider_subscription_id,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      updated_at = excluded.updated_at
  `).bind(
    makeId('sub'), account.id, service, plan.code, plan.name, plan.amountKrw, status,
    String(body.provider || ''), String(body.providerSubscriptionId || ''),
    String(body.currentPeriodStart || ''), String(body.currentPeriodEnd || ''), now, now,
  ).run();
}

async function recordCharge(db, account, body = {}) {
  const service = normalizeService(body.service);
  const amountKrw = Math.max(0, Math.round(Number(body.amountKrw || 0)));
  const providerRef = String(body.providerRef || '').trim();
  const status = String(body.status || 'paid').trim().toLowerCase();
  if (!service || !amountKrw) throw errorWithStatus('서비스와 결제 금액이 필요합니다.', 400, 'CHARGE_INVALID');
  if (providerRef) {
    const duplicate = await db.prepare(`
      SELECT id FROM account_finance_ledger
      WHERE provider_ref = ? AND entry_type = 'charge' AND service = ?
      LIMIT 1
    `).bind(providerRef, service).first();
    if (duplicate?.id) return;
  }
  const now = nowIso();
  const statements = [db.prepare(`
    INSERT INTO account_finance_ledger (
      id, account_id, service, entry_type, amount_krw, status,
      related_account_id, provider_ref, occurred_at, available_at, paid_at,
      metadata_json, created_at
    ) VALUES (?, ?, ?, 'charge', ?, ?, '', ?, ?, '', ?, ?, ?)
  `).bind(
    makeId('ledger'), account.id, service, amountKrw, status, providerRef, now,
    status === 'paid' ? now : '', JSON.stringify(body.metadata || {}), now,
  )];

  const referral = await db.prepare(`
    SELECT referrer_account_id, commission_rate_bps
    FROM account_referrals
    WHERE referred_account_id = ? AND status = 'active'
    LIMIT 1
  `).bind(account.id).first();
  if (referral?.referrer_account_id && status === 'paid') {
    const commission = Math.floor(amountKrw * Number(referral.commission_rate_bps || 2000) / 10000);
    if (commission > 0) {
      statements.push(db.prepare(`
        INSERT INTO account_finance_ledger (
          id, account_id, service, entry_type, amount_krw, status,
          related_account_id, provider_ref, occurred_at, available_at, paid_at,
          metadata_json, created_at
        ) VALUES (?, ?, ?, 'commission', ?, 'pending', ?, ?, ?, '', '', ?, ?)
      `).bind(
        makeId('commission'), referral.referrer_account_id, service, commission,
        account.id, providerRef, now,
        JSON.stringify({ sourceAmountKrw: amountKrw, commissionRateBps: Number(referral.commission_rate_bps || 2000) }), now,
      ));
    }
  }
  await db.batch(statements);
}

async function recordPayout(db, account, body = {}) {
  const amountKrw = Math.max(0, Math.round(Number(body.amountKrw || 0)));
  if (!amountKrw) throw errorWithStatus('정산 금액이 필요합니다.', 400, 'PAYOUT_INVALID');
  const now = nowIso();
  await db.prepare(`
    INSERT INTO account_finance_ledger (
      id, account_id, service, entry_type, amount_krw, status,
      related_account_id, provider_ref, occurred_at, available_at, paid_at,
      metadata_json, created_at
    ) VALUES (?, ?, 'combined', 'payout', ?, ?, '', ?, ?, '', ?, ?, ?)
  `).bind(
    makeId('payout'), account.id, amountKrw, String(body.status || 'paid'),
    String(body.providerRef || ''), now, String(body.status || 'paid') === 'paid' ? now : '',
    JSON.stringify(body.metadata || {}), now,
  ).run();
}

function checkoutUrl(request, env, service, planCode) {
  const configured = service === 'pagero'
    ? String(env.PAGERO_CHECKOUT_URL || '').trim()
    : String(env.CALLTAG_CHECKOUT_URL || '').trim();
  const base = configured || (service === 'pagero'
    ? new URL('/subscribe', request.url).toString()
    : 'https://calltag.pagero.kr/subscribe');
  const url = new URL(base, request.url);
  url.searchParams.set('service', service);
  url.searchParams.set('plan', planCode);
  return url.toString();
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  try {
    const db = assertD1(env);
    await ensureFinanceSchema(db);

    if (request.method === 'GET') {
      const identity = await sessionIdentity(request, env);
      if (!identity) throw errorWithStatus('로그인이 필요합니다.', 401, 'AUTH_SESSION_REQUIRED');
      const account = await accountForIdentity(db, identity);
      return jsonResponse(request, env, 200, { ok: true, finance: await financeSnapshot(db, account) }, METHODS);
    }

    if (request.method !== 'POST') throw errorWithStatus('허용되지 않은 요청입니다.', 405, 'METHOD_NOT_ALLOWED');
    const body = await readJson(request);
    const action = String(body.action || '').trim().toLowerCase();
    const internalAction = ['update-subscription', 'record-charge', 'record-payout'].includes(action);
    const internalAuthorized = internalAction && apiTokenAuthorized(request, env);
    const identity = internalAuthorized ? null : await sessionIdentity(request, env);
    if (!internalAuthorized && !identity) throw errorWithStatus('로그인이 필요합니다.', 401, 'AUTH_SESSION_REQUIRED');
    const account = internalAuthorized
      ? await accountForInternalRequest(db, body)
      : await accountForIdentity(db, identity);
    await ensureProfile(db, account);

    if (action === 'apply-referral') {
      await applyReferral(db, account, body.code);
    } else if (action === 'create-checkout') {
      const service = normalizeService(body.service);
      const planCode = String(body.planCode || '').trim().toLowerCase();
      if (!service || !planByCode(service, planCode) || planCode === 'free') {
        throw errorWithStatus('결제할 요금제를 선택해주세요.', 400, 'CHECKOUT_PLAN_INVALID');
      }
      return jsonResponse(request, env, 200, {
        ok: true,
        checkoutUrl: checkoutUrl(request, env, service, planCode),
      }, METHODS);
    } else if (action === 'update-subscription' && internalAuthorized) {
      await updateSubscription(db, account, body);
    } else if (action === 'record-charge' && internalAuthorized) {
      await recordCharge(db, account, body);
    } else if (action === 'record-payout' && internalAuthorized) {
      await recordPayout(db, account, body);
    } else if (!['refresh'].includes(action)) {
      throw errorWithStatus('지원하지 않는 작업입니다.', 400, 'FINANCE_ACTION_INVALID');
    }

    return jsonResponse(request, env, 200, { ok: true, finance: await financeSnapshot(db, account) }, METHODS);
  } catch (error) {
    return jsonResponse(request, env, Number(error?.status || 500), {
      ok: false,
      code: String(error?.code || 'ACCOUNT_FINANCE_FAILED'),
      error: String(error?.message || '계정 결제 정보를 처리하지 못했습니다.'),
      message: String(error?.message || '계정 결제 정보를 처리하지 못했습니다.'),
    }, METHODS);
  }
}
