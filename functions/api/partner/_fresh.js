import { partnerAuthSession, partnerSecurityError } from './_security.js';

export const PARTNER_FRESH_COOKIE = 'ct_partner_sensitive';
export const PARTNER_FRESH_TTL_SECONDS = 5 * 60;

export async function ensurePartnerFreshSchema(db) {
  if (!db?.prepare) throw partnerSecurityError('보안 저장소가 연결되지 않았습니다.', 503, 'PARTNER_SECURITY_DB_REQUIRED');
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_sensitive_sessions (
      token_hash TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      revoked_at TEXT NOT NULL DEFAULT ''
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_partner_sensitive_sessions_owner_expiry
    ON partner_sensitive_sessions(owner_id, expires_at)
  `).run();
}

export async function createFreshSensitiveSession(db, ownerId) {
  await ensurePartnerFreshSchema(db);
  const token = randomToken();
  const tokenHash = await sha256Hex(`partner-sensitive-session:v1:${token}`);
  const expiresAt = new Date(Date.now() + PARTNER_FRESH_TTL_SECONDS * 1000).toISOString();
  await db.prepare(`
    DELETE FROM partner_sensitive_sessions
    WHERE datetime(expires_at) <= CURRENT_TIMESTAMP OR revoked_at <> ''
  `).run();
  await db.prepare(`
    INSERT INTO partner_sensitive_sessions (token_hash, owner_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(tokenHash, ownerId, expiresAt).run();
  return { token, expiresAt };
}

export async function requireFreshSensitiveStepup(request, env) {
  const auth = await partnerAuthSession(request, env);
  await ensurePartnerFreshSchema(env.DB);
  const token = cookieValue(request.headers.get('Cookie') || '', PARTNER_FRESH_COOKIE);
  if (!token) {
    throw partnerSecurityError('계좌 변경 또는 지급 요청 전에 구글 OTP를 다시 확인해주세요.', 401, 'PARTNER_TOTP_FRESH_REQUIRED');
  }
  const tokenHash = await sha256Hex(`partner-sensitive-session:v1:${token}`);
  const row = await env.DB.prepare(`
    SELECT token_hash, owner_id, created_at, expires_at
    FROM partner_sensitive_sessions
    WHERE token_hash = ? AND owner_id = ? AND revoked_at = ''
      AND datetime(expires_at) > CURRENT_TIMESTAMP
    LIMIT 1
  `).bind(tokenHash, auth.ownerId).first();
  if (!row?.token_hash) {
    throw partnerSecurityError('보안 확인 시간이 지났습니다. 구글 OTP를 다시 입력해주세요.', 401, 'PARTNER_TOTP_FRESH_REQUIRED');
  }
  return { ...auth, sensitiveSession: row };
}

export async function revokeFreshSensitiveSessions(db, ownerId = '') {
  if (!db?.prepare || !ownerId) return;
  await ensurePartnerFreshSchema(db);
  await db.prepare(`
    UPDATE partner_sensitive_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE owner_id = ? AND revoked_at = ''
  `).bind(ownerId).run();
}

export function partnerFreshCookie(session = {}, request = null) {
  return cookieHeader(PARTNER_FRESH_COOKIE, session.token || '', PARTNER_FRESH_TTL_SECONDS, request);
}

export function clearPartnerFreshCookie(request = null) {
  return cookieHeader(PARTNER_FRESH_COOKIE, '', 0, request);
}

function cookieHeader(name, value, maxAge, request) {
  const secure = isHttpsRequest(request) ? '; Secure' : '';
  return `${name}=${encodeURIComponent(String(value || ''))}; Path=/api/partner; HttpOnly${secure}; SameSite=Strict; Max-Age=${Math.max(0, Math.trunc(maxAge || 0))}`;
}

function cookieValue(header = '', name = '') {
  for (const part of String(header || '').split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) {
      try { return decodeURIComponent(rest.join('=')); } catch { return rest.join('='); }
    }
  }
  return '';
}

function isHttpsRequest(request) {
  try { return new URL(request?.url || '').protocol === 'https:'; } catch { return true; }
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
