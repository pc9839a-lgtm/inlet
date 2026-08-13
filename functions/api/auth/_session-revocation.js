let schemaPromise = null;

const REVOCATION_TTL_SECONDS = 31 * 24 * 60 * 60;
const PARTNER_AUTH_COOKIE = 'ct_partner_auth';

export async function ensureSessionRevocationSchema(db) {
  if (!db?.prepare) return false;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS auth_session_revocations (
          token_hash TEXT PRIMARY KEY,
          revoked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT NOT NULL
        )
      `).run();
      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_auth_session_revocations_expiry
        ON auth_session_revocations(expires_at)
      `).run();
      return true;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export async function revokeSessionToken(db, token = '') {
  const session = String(token || '').trim();
  if (!db?.prepare || !session) return false;
  await ensureSessionRevocationSchema(db);
  const tokenHash = await sessionTokenHash(session);
  const expiresAt = tokenExpiry(session) || new Date(Date.now() + REVOCATION_TTL_SECONDS * 1000).toISOString();
  await db.prepare(`
    DELETE FROM auth_session_revocations
    WHERE datetime(expires_at) <= CURRENT_TIMESTAMP
  `).run();
  await db.prepare(`
    INSERT INTO auth_session_revocations (token_hash, revoked_at, expires_at)
    VALUES (?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(token_hash) DO UPDATE SET
      revoked_at = CURRENT_TIMESTAMP,
      expires_at = excluded.expires_at
  `).bind(tokenHash, expiresAt).run();
  return true;
}

export async function isSessionTokenRevoked(db, token = '') {
  const session = String(token || '').trim();
  if (!db?.prepare || !session) return false;
  await ensureSessionRevocationSchema(db);
  const tokenHash = await sessionTokenHash(session);
  const row = await db.prepare(`
    SELECT token_hash
    FROM auth_session_revocations
    WHERE token_hash = ? AND datetime(expires_at) > CURRENT_TIMESTAMP
    LIMIT 1
  `).bind(tokenHash).first();
  return !!row?.token_hash;
}

export async function sessionTokenFromAnyRequest(request, options = {}) {
  const header = String(request?.headers?.get?.('X-Inlet-Session') || '').trim();
  if (header) return header;
  const authorization = String(request?.headers?.get?.('Authorization') || '').trim();
  const bearer = authorization.replace(/^Bearer\s+/i, '').trim();
  if (bearer && bearer !== authorization) return bearer;
  const cookie = cookieValue(request?.headers?.get?.('Cookie') || '', PARTNER_AUTH_COOKIE);
  if (cookie) return cookie;

  if (options.includeBody !== true) return '';
  const method = String(request?.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return '';
  const contentType = String(request?.headers?.get?.('Content-Type') || '').toLowerCase();
  if (!contentType.includes('application/json')) return '';
  const length = Number(request?.headers?.get?.('Content-Length') || 0);
  if (Number.isFinite(length) && length > 32 * 1024) return '';
  try {
    const body = await request.clone().json();
    return String(body?.session || '').trim();
  } catch {
    return '';
  }
}

export async function isRequestSessionRevoked(request, env = {}) {
  if (!env?.DB?.prepare) return false;
  const token = await sessionTokenFromAnyRequest(request, { includeBody: true });
  return token ? isSessionTokenRevoked(env.DB, token) : false;
}

function cookieValue(header = '', name = '') {
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0 || part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try { return decodeURIComponent(raw); } catch { return raw; }
  }
  return '';
}

function tokenExpiry(token = '') {
  try {
    const payloadPart = String(token || '').split('.')[0] || '';
    if (!payloadPart) return '';
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const payload = JSON.parse(atob(padded));
    const exp = Number(payload?.exp || 0);
    if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return '';
    return new Date(exp * 1000).toISOString();
  } catch {
    return '';
  }
}

async function sessionTokenHash(token = '') {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`inlet-auth-session-revocation:v1:${token}`));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
