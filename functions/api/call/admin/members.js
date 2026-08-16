import { ensureCalltagAdminEntitlementSchema } from '../../billing/_adminEntitlements.js';
import {
  adminErrorResponse,
  adminJson,
  adminOptions,
  maskEmail,
  maskPhone,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';

const CALLTAG_PRODUCTS_SQL = "'call_monthly','message_monthly','all_monthly'";
const PAGE_SIZE = 40;

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  try {
    if (!env.DB?.prepare) return adminJson(503, { ok: false, error: '관리자 저장소가 연결되지 않았습니다.', code: 'CALLTAG_ADMIN_DB_REQUIRED' });
    const identity = await requireCalltagAdmin(request, env);
    const url = new URL(request.url);
    const query = searchText(url.searchParams.get('q'));
    const page = pageNumber(url.searchParams.get('page'));
    const offset = (page - 1) * PAGE_SIZE;
    const pattern = `%${escapeLike(query.toLowerCase())}%`;
    const where = query
      ? `WHERE lower(COALESCE(owner_id, '')) LIKE ? ESCAPE '\\'
          OR lower(COALESCE(email, '')) LIKE ? ESCAPE '\\'
          OR lower(COALESCE(phone, '')) LIKE ? ESCAPE '\\'`
      : '';
    const bindings = query ? [pattern, pattern, pattern] : [];

    const count = await env.DB.prepare(`SELECT COUNT(*) AS value FROM calllink_profiles ${where}`)
      .bind(...bindings).first();
    const total = clampNumber(count?.value, 0, 10_000_000);
    const result = await env.DB.prepare(`
      SELECT owner_id, email, phone, created_at, updated_at
      FROM calllink_profiles
      ${where}
      ORDER BY datetime(created_at) DESC, owner_id DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, PAGE_SIZE, offset).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const ownerIds = rows.map((row) => String(row?.owner_id || '')).filter(Boolean);
    const [accounts, subscriptions, adminEntitlements] = await Promise.all([
      loadAccounts(env.DB, ownerIds),
      loadSubscriptions(env.DB, ownerIds),
      loadAdminEntitlements(env.DB, ownerIds),
    ]);

    await recordAdminAudit(env.DB, request, env, identity, 'members.search');
    return adminJson(200, {
      ok: true,
      query,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      members: rows.map((row) => {
        const ownerId = String(row.owner_id || '').slice(0, 120);
        return {
          ownerId,
          email: maskEmail(row.email),
          phone: maskPhone(row.phone),
          createdAt: safeIso(row.created_at),
          updatedAt: safeIso(row.updated_at),
          trialEndsAt: safeIso(accounts.get(ownerId)?.trial_ends_at),
          referralBonusDays: clampNumber(accounts.get(ownerId)?.referral_bonus_days, 0, 31),
          subscriptions: subscriptions.get(ownerId) || [],
          adminEntitlement: adminEntitlements.get(ownerId) || null,
        };
      }),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

async function loadAccounts(db, ownerIds) {
  const map = new Map();
  if (!ownerIds.length) return map;
  try {
    const placeholders = ownerIds.map(() => '?').join(',');
    const result = await db.prepare(`
      SELECT owner_id, trial_ends_at, referral_bonus_days
      FROM billing_accounts
      WHERE owner_id IN (${placeholders})
    `).bind(...ownerIds).all();
    for (const row of (Array.isArray(result?.results) ? result.results : [])) map.set(String(row.owner_id || ''), row);
  } catch {}
  return map;
}

async function loadSubscriptions(db, ownerIds) {
  const map = new Map();
  if (!ownerIds.length) return map;
  try {
    const placeholders = ownerIds.map(() => '?').join(',');
    const result = await db.prepare(`
      SELECT owner_id, product_code, channel, status, verification_state,
             started_at, next_billing_at, expires_at, last_verified_at, auto_renewing
      FROM billing_subscriptions
      WHERE owner_id IN (${placeholders})
        AND product_code IN (${CALLTAG_PRODUCTS_SQL})
        AND status IN ('active','grace','cancelled','pending','suspended')
        AND (COALESCE(expires_at, '') = '' OR datetime(expires_at) > datetime('now'))
      ORDER BY owner_id,
        CASE product_code WHEN 'all_monthly' THEN 0 WHEN 'call_monthly' THEN 1 ELSE 2 END,
        datetime(updated_at) DESC
    `).bind(...ownerIds).all();
    for (const row of (Array.isArray(result?.results) ? result.results : [])) {
      const ownerId = String(row.owner_id || '');
      if (!ownerId) continue;
      const list = map.get(ownerId) || [];
      const item = {
        productCode: token(row.product_code, 80),
        channel: token(row.channel, 32),
        status: token(row.status, 32),
        verificationState: token(row.verification_state, 32),
        startedAt: safeIso(row.started_at),
        nextBillingAt: safeIso(row.next_billing_at),
        expiresAt: safeIso(row.expires_at),
        lastVerifiedAt: safeIso(row.last_verified_at),
        autoRenewing: Number(row.auto_renewing || 0) === 1,
      };
      const key = `${item.productCode}:${item.channel}:${item.status}:${item.expiresAt}`;
      if (!list.some((entry) => `${entry.productCode}:${entry.channel}:${entry.status}:${entry.expiresAt}` === key)) list.push(item);
      map.set(ownerId, list.slice(0, 6));
    }
  } catch {}
  return map;
}

async function loadAdminEntitlements(db, ownerIds) {
  const map = new Map();
  if (!ownerIds.length) return map;
  try {
    await ensureCalltagAdminEntitlementSchema(db);
    const placeholders = ownerIds.map(() => '?').join(',');
    const result = await db.prepare(`
      SELECT owner_id, scope, status, starts_at, expires_at
      FROM calltag_admin_entitlements
      WHERE owner_id IN (${placeholders})
    `).bind(...ownerIds).all();
    for (const row of (Array.isArray(result?.results) ? result.results : [])) {
      const ownerId = String(row.owner_id || '');
      if (!ownerId) continue;
      const expiresAt = safeIso(row.expires_at);
      const active = String(row.status || '').toLowerCase() === 'active'
        && Number.isFinite(Date.parse(expiresAt))
        && Date.parse(expiresAt) > Date.now();
      map.set(ownerId, {
        active,
        status: active ? 'active' : (String(row.status || '').toLowerCase() === 'active' ? 'expired' : token(row.status, 24)),
        scope: ['call', 'message', 'all'].includes(String(row.scope || '')) ? String(row.scope) : '',
        startsAt: safeIso(row.starts_at),
        expiresAt,
      });
    }
  } catch {}
  return map;
}

function searchText(value) {
  return String(value || '').trim().replace(/[\r\n<>]/g, '').slice(0, 80);
}

function escapeLike(value) {
  return String(value || '').replace(/[\\%_]/g, (match) => `\\${match}`);
}

function pageNumber(value) {
  const number = Math.trunc(Number(value || 1));
  return Number.isFinite(number) ? Math.max(1, Math.min(2500, number)) : 1;
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

function token(value, max) {
  const raw = String(value || '').trim();
  return /^[A-Za-z0-9._:+-]*$/.test(raw) ? raw.slice(0, max) : '';
}
