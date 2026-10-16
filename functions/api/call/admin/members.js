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
    const filter = evidenceFilter(url.searchParams.get('filter'));
    const available = await memberEvidenceTables(env.DB);
    const offset = (page - 1) * PAGE_SIZE;
    const pattern = `%${escapeLike(query.toLowerCase())}%`;
    // Only verifiable grant/purchase evidence qualifies. Beta and estimates do not.
    const grantExists = grantEvidenceSql(available);
    const purchasedExists = purchaseEvidenceSql(available);
    const conditions = [];
    if (query) conditions.push(`(lower(COALESCE(m.owner_id, '')) LIKE ? ESCAPE '\\'
       OR lower(COALESCE(NULLIF(p.email, ''), a.email, '')) LIKE ? ESCAPE '\\'
       OR lower(COALESCE(NULLIF(p.phone, ''), a.phone, '')) LIKE ? ESCAPE '\\')`);
    if (filter === 'granted') conditions.push(grantExists);
    if (filter === 'purchased') conditions.push(purchasedExists);
    const where = conditions.length ? `WHERE ${conditions.map((condition) => `(${condition})`).join(' AND ')}` : '';
    // CallTag profile OR authenticated Google CallTag entitlement, never all Pagero users.
    const membersFrom = `
      FROM (
        SELECT owner_id FROM calllink_profiles
        UNION
        SELECT e.owner_id FROM calllink_entitlements e
        JOIN accounts aa ON aa.id = e.owner_id AND aa.status = 'active'
        UNION
        SELECT s.owner_id FROM billing_subscriptions s
        JOIN accounts ba ON ba.id = s.owner_id AND ba.status = 'active'
        WHERE s.product_code IN (${CALLTAG_PRODUCTS_SQL})
          AND s.verification_state = 'verified'
          AND s.channel IN ('google_play','play','web')
      ) m
      LEFT JOIN calllink_profiles p ON p.owner_id = m.owner_id
      LEFT JOIN accounts a ON a.id = m.owner_id`;
    const bindings = query ? [pattern, pattern, pattern] : [];

    const count = await env.DB.prepare(`SELECT COUNT(*) AS value ${membersFrom} ${where}`)
      .bind(...bindings).first();
    const total = clampNumber(count?.value, 0, 10_000_000);
    const result = await env.DB.prepare(`
      SELECT m.owner_id,
             COALESCE(NULLIF(p.email, ''), a.email, '') AS email,
             COALESCE(NULLIF(p.phone, ''), a.phone, '') AS phone,
             COALESCE(NULLIF(p.created_at, ''), a.created_at, '') AS created_at,
             COALESCE(NULLIF(p.updated_at, ''), a.updated_at, '') AS updated_at
      ${membersFrom}
      ${where}
      ORDER BY datetime(COALESCE(NULLIF(p.created_at, ''), a.created_at, '')) DESC, m.owner_id DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, PAGE_SIZE, offset).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const ownerIds = rows.map((row) => String(row?.owner_id || '')).filter(Boolean);
    const [accounts, subscriptions, adminEntitlements, legacyEntitlements, verifiedPurchases, grantAudits] = await Promise.all([
      loadAccounts(env.DB, ownerIds),
      loadSubscriptions(env.DB, ownerIds),
      loadAdminEntitlements(env.DB, ownerIds),
      loadLegacyEntitlements(env.DB, ownerIds),
      loadVerifiedPurchases(env.DB, ownerIds, available),
      loadGrantAudits(env.DB, ownerIds, available),
    ]);

    await recordAdminAudit(env.DB, request, env, identity, 'members.search');
    return adminJson(200, {
      ok: true,
      query,
      filter,
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
          legacyEntitlement: legacyEntitlements.get(ownerId) || null,
          grantHistory: {
            recorded: Boolean(adminEntitlements.has(ownerId) || grantAudits.has(ownerId) || legacyManualGrant(legacyEntitlements.get(ownerId))),
            source: adminEntitlements.has(ownerId) ? 'admin' : grantAudits.has(ownerId) ? 'audit' : legacyManualGrant(legacyEntitlements.get(ownerId)) ? 'legacy_manual' : '',
          },
          purchaseHistory: verifiedPurchases.get(ownerId) || { recorded: false, refunded: false, evidence: '', channel: '', productCode: '', verifiedAt: '' },
        };
      }),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

// Read only. Query missing optional history tables defensively.
async function memberEvidenceTables(db) {
  const names = ['calltag_admin_entitlements', 'calltag_admin_audit', 'calllink_entitlements', 'billing_subscriptions', 'billing_payment_events'];
  const result = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${names.map(() => '?').join(',')})`).bind(...names).all();
  return new Set((Array.isArray(result?.results) ? result.results : []).map((row) => String(row.name || '')));
}

function grantEvidenceSql(tables) {
  const checks = [];
  if (tables.has('calltag_admin_entitlements')) checks.push(`EXISTS (SELECT 1 FROM calltag_admin_entitlements g WHERE g.owner_id = m.owner_id)`);
  if (tables.has('calltag_admin_audit')) checks.push(`EXISTS (SELECT 1 FROM calltag_admin_audit h WHERE h.target_owner_id = m.owner_id AND h.action = 'member.entitlement.grant' AND h.outcome = 'ok')`);
  if (tables.has('calllink_entitlements')) checks.push(`EXISTS (SELECT 1 FROM calllink_entitlements l WHERE l.owner_id = m.owner_id AND lower(l.source) IN ('manual','admin','admin_grant'))`);
  return checks.length ? `(${checks.join(' OR ')})` : '0 = 1';
}

function purchaseEvidenceSql(tables) {
  const checks = [];
  if (tables.has('billing_subscriptions')) checks.push(`EXISTS (
    SELECT 1 FROM billing_subscriptions p WHERE p.owner_id = m.owner_id
      AND p.product_code IN (${CALLTAG_PRODUCTS_SQL})
      AND p.channel IN ('google_play','play','web')
      AND p.verification_state = 'verified'
      AND p.status IN ('active','grace','cancelled','expired','suspended','refunded')
  )`);
  if (tables.has('billing_payment_events')) checks.push(`EXISTS (
    SELECT 1 FROM billing_payment_events e WHERE e.owner_id = m.owner_id
      AND e.product_code IN (${CALLTAG_PRODUCTS_SQL}) AND e.event_type = 'charge'
      AND e.payment_status = 'paid' AND e.amount_krw > 0
      AND e.amount_source IN ('provider_confirmed','play_earnings_report','google_play_orders_api')
  )`);
  return checks.length ? `(${checks.join(' OR ')})` : '0 = 1';
}

function legacyManualGrant(row) {
  return ['manual','admin','admin_grant'].includes(String(row?.source || '').toLowerCase());
}

function evidenceFilter(value) {
  return ['granted','purchased'].includes(String(value || '').toLowerCase()) ? String(value).toLowerCase() : 'all';
}

async function loadGrantAudits(db, ownerIds, tables) {
  const result = new Set();
  if (!ownerIds.length || !tables.has('calltag_admin_audit')) return result;
  const slots = ownerIds.map(() => '?').join(',');
  try {
    const rows = await db.prepare(`SELECT DISTINCT target_owner_id FROM calltag_admin_audit WHERE target_owner_id IN (${slots}) AND action = 'member.entitlement.grant' AND outcome = 'ok'`).bind(...ownerIds).all();
    for (const row of (Array.isArray(rows?.results) ? rows.results : [])) result.add(String(row.target_owner_id || ''));
  } catch (error) { console.warn('calltag-admin-grant-history-unavailable', String(error?.message || 'query_failed').slice(0, 100)); }
  return result;
}

async function loadVerifiedPurchases(db, ownerIds, tables) {
  const map = new Map();
  if (!ownerIds.length) return map;
  const slots = ownerIds.map(() => '?').join(',');
  if (tables.has('billing_subscriptions')) {
    try {
      const rows = await db.prepare(`SELECT owner_id, product_code, channel, status, last_verified_at FROM billing_subscriptions
        WHERE owner_id IN (${slots}) AND product_code IN (${CALLTAG_PRODUCTS_SQL})
          AND channel IN ('google_play','play','web') AND verification_state = 'verified'
          AND status IN ('active','grace','cancelled','expired','suspended','refunded')
        ORDER BY datetime(last_verified_at) DESC, id DESC`).bind(...ownerIds).all();
      for (const row of (Array.isArray(rows?.results) ? rows.results : [])) {
        const owner = String(row.owner_id || '');
        if (!owner || map.has(owner)) continue;
        map.set(owner, { recorded: true, refunded: String(row.status) === 'refunded', evidence: 'subscription_verified', channel: token(row.channel, 32), productCode: token(row.product_code, 80), verifiedAt: safeIso(row.last_verified_at) });
      }
    } catch (error) { console.warn('calltag-admin-purchase-verification-unavailable', String(error?.message || 'query_failed').slice(0, 100)); }
  }
  if (tables.has('billing_payment_events')) {
    try {
      const rows = await db.prepare(`SELECT owner_id, product_code, channel, paid_at FROM billing_payment_events
        WHERE owner_id IN (${slots}) AND product_code IN (${CALLTAG_PRODUCTS_SQL})
          AND event_type = 'charge' AND payment_status = 'paid' AND amount_krw > 0
          AND amount_source IN ('provider_confirmed','play_earnings_report','google_play_orders_api')
        ORDER BY datetime(paid_at) DESC, id DESC`).bind(...ownerIds).all();
      for (const row of (Array.isArray(rows?.results) ? rows.results : [])) {
        const owner = String(row.owner_id || '');
        if (!owner) continue;
        // A positive, provider-confirmed charge outranks subscription verification.
        map.set(owner, { recorded: true, refunded: false, evidence: 'confirmed_charge', channel: token(row.channel, 32), productCode: token(row.product_code, 80), verifiedAt: safeIso(row.paid_at) });
      }
    } catch (error) { console.warn('calltag-admin-payment-events-unavailable', String(error?.message || 'query_failed').slice(0, 100)); }
  }
  return map;
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

// Historical records are shown for reconciliation only. This query does not
// grant, revoke, renew, or infer active app feature access.
async function loadLegacyEntitlements(db, ownerIds) {
  const resultMap = new Map();
  if (!ownerIds.length) return resultMap;
  try {
    const slots = ownerIds.map(() => '?').join(',');
    const result = await db.prepare(`
      SELECT owner_id, status, plan_code, source, paid_until, created_at, updated_at
      FROM calllink_entitlements
      WHERE owner_id IN (${slots})
    `).bind(...ownerIds).all();
    for (const row of (Array.isArray(result?.results) ? result.results : [])) {
      const ownerId = String(row.owner_id || '');
      if (!ownerId) continue;
      const planCode = token(row.plan_code, 80);
      const source = token(row.source, 80);
      resultMap.set(ownerId, {
        status: token(row.status, 24),
        planCode,
        source,
        paidUntil: safeIso(row.paid_until),
        updatedAt: safeIso(row.updated_at),
        // beta_free is not evidence that a user was never previously granted access.
        nonDefaultRecord: planCode !== 'beta_free' || source !== 'beta' || Boolean(row.paid_until),
      });
    }
  } catch (error) {
    console.warn('calltag-admin-legacy-records-unavailable', String(error?.message || 'query_failed').slice(0, 120));
  }
  return resultMap;
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
