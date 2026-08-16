const ADMIN_ENTITLEMENT_SCOPES = new Set(['call', 'message', 'all']);

export async function ensureCalltagAdminEntitlementSchema(db) {
  if (!db?.prepare) throw new Error('CallTag admin entitlement database is not configured.');
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_admin_entitlements (
      owner_id TEXT PRIMARY KEY,
      scope TEXT NOT NULL DEFAULT 'all',
      status TEXT NOT NULL DEFAULT 'active',
      starts_at TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      granted_by TEXT NOT NULL DEFAULT '',
      granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_by TEXT NOT NULL DEFAULT '',
      revoked_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_calltag_admin_entitlements_status_expiry
    ON calltag_admin_entitlements(status, expires_at)
  `).run();
}

export async function getCalltagAdminEntitlement(db, ownerId = '', { activeOnly = false } = {}) {
  await ensureCalltagAdminEntitlementSchema(db);
  const safeOwnerId = text(ownerId, 120);
  if (!safeOwnerId) return null;
  const row = await db.prepare(`
    SELECT owner_id, scope, status, starts_at, expires_at, note,
           granted_by, granted_at, revoked_by, revoked_at, updated_at
    FROM calltag_admin_entitlements
    WHERE owner_id = ?
    LIMIT 1
  `).bind(safeOwnerId).first();
  const result = adminEntitlementPublic(row);
  return activeOnly && result?.active !== true ? null : result;
}

export async function grantCalltagAdminEntitlement(db, input = {}) {
  await ensureCalltagAdminEntitlementSchema(db);
  const ownerId = text(input.ownerId, 120);
  const requestedScope = normalizeAdminEntitlementScope(input.scope);
  const grantedBy = text(input.grantedBy, 120);
  const note = text(input.note, 300);
  const durationDays = clampDays(input.durationDays);
  if (!ownerId || !requestedScope || !grantedBy || !durationDays) {
    throw new Error('Invalid CallTag admin entitlement grant.');
  }

  const current = await getCalltagAdminEntitlement(db, ownerId);
  const scope = mergeAdminEntitlementScopes(current?.active === true ? current.scope : '', requestedScope);
  const now = Date.now();
  const currentExpiry = current?.active === true ? Date.parse(String(current.expiresAt || '')) : 0;
  const baseMs = Number.isFinite(currentExpiry) && currentExpiry > now ? currentExpiry : now;
  const startsAt = current?.active === true && current.startsAt ? current.startsAt : new Date(now).toISOString();
  const expiresAt = new Date(baseMs + durationDays * 24 * 60 * 60 * 1000).toISOString();

  await db.prepare(`
    INSERT INTO calltag_admin_entitlements (
      owner_id, scope, status, starts_at, expires_at, note,
      granted_by, granted_at, revoked_by, revoked_at, updated_at
    ) VALUES (?, ?, 'active', ?, ?, ?, ?, CURRENT_TIMESTAMP, '', '', CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id) DO UPDATE SET
      scope = excluded.scope,
      status = 'active',
      starts_at = excluded.starts_at,
      expires_at = excluded.expires_at,
      note = excluded.note,
      granted_by = excluded.granted_by,
      granted_at = CURRENT_TIMESTAMP,
      revoked_by = '',
      revoked_at = '',
      updated_at = CURRENT_TIMESTAMP
  `).bind(ownerId, scope, startsAt, expiresAt, note, grantedBy).run();
  return getCalltagAdminEntitlement(db, ownerId);
}

export async function revokeCalltagAdminEntitlement(db, input = {}) {
  await ensureCalltagAdminEntitlementSchema(db);
  const ownerId = text(input.ownerId, 120);
  const revokedBy = text(input.revokedBy, 120);
  if (!ownerId || !revokedBy) throw new Error('Invalid CallTag admin entitlement revoke.');
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE calltag_admin_entitlements
    SET status = 'revoked',
        expires_at = ?,
        revoked_by = ?,
        revoked_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE owner_id = ?
  `).bind(now, revokedBy, now, ownerId).run();
  return getCalltagAdminEntitlement(db, ownerId);
}

export function adminEntitlementPublic(row = null) {
  if (!row?.owner_id && !row?.ownerId) return null;
  const status = String(row?.status || '').trim().toLowerCase();
  const scope = normalizeAdminEntitlementScope(row?.scope) || 'all';
  const expiresAt = iso(row?.expires_at || row?.expiresAt);
  const expiresMs = Date.parse(expiresAt);
  const active = status === 'active' && Number.isFinite(expiresMs) && expiresMs > Date.now();
  return {
    active,
    status: active ? 'active' : (status === 'active' ? 'expired' : status || 'inactive'),
    scope,
    startsAt: iso(row?.starts_at || row?.startsAt),
    expiresAt,
    note: text(row?.note, 300),
    grantedAt: iso(row?.granted_at || row?.grantedAt),
    revokedAt: iso(row?.revoked_at || row?.revokedAt),
    updatedAt: iso(row?.updated_at || row?.updatedAt),
  };
}

export function normalizeAdminEntitlementScope(value = '') {
  const scope = String(value || '').trim().toLowerCase();
  return ADMIN_ENTITLEMENT_SCOPES.has(scope) ? scope : '';
}

function mergeAdminEntitlementScopes(currentScope = '', requestedScope = '') {
  const current = normalizeAdminEntitlementScope(currentScope);
  const requested = normalizeAdminEntitlementScope(requestedScope);
  if (!current) return requested;
  if (!requested || current === requested) return current;
  if (current === 'all' || requested === 'all') return 'all';
  return 'all';
}

function clampDays(value) {
  const days = Math.trunc(Number(value || 0));
  return Number.isFinite(days) && days >= 1 && days <= 3660 ? days : 0;
}

function text(value, max) {
  return String(value || '').trim().replace(/[\r\n<>]/g, '').slice(0, max);
}

function iso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}
