import { getSessionAccount } from '../auth/_auth.js';

export const CALL_METHODS = 'GET, POST, PATCH, OPTIONS';
export const CALLLINK_BETA_PLAN = 'beta_free';

export function callError(message, status = 400, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

export function normalizeText(value = '', max = 120) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function normalizeEntitlementStatus(value = '') {
  const status = String(value || '').trim().toLowerCase();
  return ['pending_payment', 'active', 'expired', 'suspended'].includes(status)
    ? status
    : 'active';
}

export function entitlementPublic(row = null) {
  const status = normalizeEntitlementStatus(row?.status || 'active');
  const paidUntil = String(row?.paid_until || row?.paidUntil || '');
  const paidUntilMs = paidUntil ? Date.parse(paidUntil) : 0;
  const active = status === 'active' && (!paidUntilMs || paidUntilMs > Date.now());
  return {
    active,
    status: active ? 'active' : (status === 'active' ? 'expired' : status),
    planCode: String(row?.plan_code || row?.planCode || CALLLINK_BETA_PLAN),
    paidUntil,
    source: String(row?.source || 'beta'),
    updatedAt: String(row?.updated_at || row?.updatedAt || ''),
  };
}

export function profilePublic(row = null, user = {}) {
  return {
    ownerId: String(row?.owner_id || user.ownerId || user.id || ''),
    name: String(row?.name || user.name || ''),
    phone: String(row?.phone || user.phone || ''),
    email: String(row?.email || user.email || ''),
    brandName: String(row?.brand_name || ''),
    industry: String(row?.industry || ''),
    updatedAt: String(row?.updated_at || ''),
  };
}

export async function ensureCalllinkSchema(db) {
  if (!db?.prepare) {
    throw callError('Database is not configured.', 503, { code: 'CALL_DB_REQUIRED' });
  }
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calllink_profiles (
      owner_id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      brand_name TEXT NOT NULL DEFAULT '',
      industry TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_calllink_profiles_phone ON calllink_profiles(phone)`).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calllink_entitlements (
      owner_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active',
      plan_code TEXT NOT NULL DEFAULT 'beta_free',
      paid_until TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'beta',
      payment_customer_id TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_calllink_entitlements_status ON calllink_entitlements(status)`).run();
}

export async function upsertCallProfile(db, input = {}) {
  await ensureCalllinkSchema(db);
  const ownerId = String(input.ownerId || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const name = normalizeText(input.name, 80);
  const phone = String(input.phone || '').replace(/\D/g, '').slice(0, 20);
  const brandName = normalizeText(input.brandName, 100);
  const industry = normalizeText(input.industry, 100);
  if (!ownerId || !email || !name || !phone || !brandName || !industry) {
    throw callError('Required profile information is missing.', 400, { code: 'CALL_PROFILE_REQUIRED' });
  }
  await db.prepare(`
    INSERT INTO calllink_profiles (owner_id, email, name, phone, brand_name, industry, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      phone = excluded.phone,
      brand_name = excluded.brand_name,
      industry = excluded.industry,
      updated_at = CURRENT_TIMESTAMP
  `).bind(ownerId, email, name, phone, brandName, industry).run();
  return getCallProfile(db, ownerId);
}

/**
 * Login-first beta policy: every verified account receives full access.
 * Suspended accounts remain suspended so abuse can still be blocked.
 * Payment enforcement can later reuse the same entitlement table.
 */
export async function ensurePendingEntitlement(db, ownerId = '') {
  await ensureCalllinkSchema(db);
  if (!ownerId) return null;
  await db.prepare(`
    INSERT INTO calllink_entitlements (
      owner_id, status, plan_code, paid_until, source, created_at, updated_at
    ) VALUES (?, 'active', ?, '', 'beta', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id) DO UPDATE SET
      status = CASE
        WHEN calllink_entitlements.status = 'suspended' THEN 'suspended'
        ELSE 'active'
      END,
      plan_code = CASE
        WHEN calllink_entitlements.status = 'suspended' THEN calllink_entitlements.plan_code
        ELSE excluded.plan_code
      END,
      paid_until = CASE
        WHEN calllink_entitlements.status = 'suspended' THEN calllink_entitlements.paid_until
        ELSE ''
      END,
      source = CASE
        WHEN calllink_entitlements.status = 'suspended' THEN calllink_entitlements.source
        ELSE 'beta'
      END,
      updated_at = CURRENT_TIMESTAMP
  `).bind(ownerId, CALLLINK_BETA_PLAN).run();
  return getCallEntitlement(db, ownerId);
}

export async function getCallProfile(db, ownerId = '') {
  await ensureCalllinkSchema(db);
  if (!ownerId) return null;
  return db.prepare(`
    SELECT owner_id, email, name, phone, brand_name, industry, created_at, updated_at
    FROM calllink_profiles WHERE owner_id = ? LIMIT 1
  `).bind(ownerId).first();
}

export async function getCallEntitlement(db, ownerId = '') {
  await ensureCalllinkSchema(db);
  if (!ownerId) return null;
  return db.prepare(`
    SELECT owner_id, status, plan_code, paid_until, source, payment_customer_id, note, created_at, updated_at
    FROM calllink_entitlements WHERE owner_id = ? LIMIT 1
  `).bind(ownerId).first();
}

export async function callSession(request, env, input = {}) {
  const { user, payload } = await getSessionAccount(request, env, input);
  const ownerId = String(user.ownerId || user.id || payload.ownerId || '');
  const profile = await getCallProfile(env.DB, ownerId);
  const entitlement = await ensurePendingEntitlement(env.DB, ownerId);
  const authorization = String(request.headers.get('Authorization') || '');
  const session = String(
    input.session
      || request.headers.get('X-Inlet-Session')
      || authorization.replace(/^Bearer\s+/i, '')
      || ''
  ).trim();
  return {
    user,
    ownerId,
    profile: profilePublic(profile, user),
    entitlement: entitlementPublic(entitlement),
    session,
  };
}

export function assertCallAdmin(request, env = {}) {
  const expected = String(env.CALLLINK_ADMIN_TOKEN || env.INLET_API_TOKEN || '').trim();
  const supplied = String(request.headers.get('X-CallLink-Admin') || '').trim();
  if (!expected || supplied !== expected) {
    throw callError('Administrator authorization failed.', 401, { code: 'CALL_ADMIN_UNAUTHORIZED' });
  }
}
