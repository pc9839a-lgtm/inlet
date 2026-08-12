import { getSessionAccount, loginAccount, authError, authSecret } from '../auth/_auth.js';
import { sendAuthVerificationEmail } from '../auth/_ses-delivery.js';

export const PARTNER_SECURITY_METHODS = 'GET, POST, OPTIONS';
export const PARTNER_AUTH_COOKIE = 'ct_partner_auth';
export const PARTNER_STEPUP_COOKIE = 'ct_partner_stepup';

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const TOTP_LOCK_AFTER = 5;
const TOTP_LOCK_SECONDS = 15 * 60;
const STEPUP_TTL_SECONDS = 12 * 60 * 60;
const RECOVERY_TTL_SECONDS = 30 * 60;
const RECOVERY_DAILY_LIMIT = 10;

export function partnerSecurityError(message, status = 400, code = 'PARTNER_SECURITY_REQUEST_FAILED', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = { code, ...details };
  return error;
}

export async function ensurePartnerSecuritySchema(db) {
  if (!db?.prepare) throw partnerSecurityError('보안 저장소가 연결되지 않았습니다.', 503, 'PARTNER_SECURITY_DB_REQUIRED');

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_totp_security (
      owner_id TEXT PRIMARY KEY,
      secret_ciphertext TEXT NOT NULL DEFAULT '',
      secret_iv TEXT NOT NULL DEFAULT '',
      pending_secret_ciphertext TEXT NOT NULL DEFAULT '',
      pending_secret_iv TEXT NOT NULL DEFAULT '',
      enabled_at TEXT NOT NULL DEFAULT '',
      last_used_counter INTEGER NOT NULL DEFAULT -1,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT NOT NULL DEFAULT '',
      recovery_code_hash TEXT NOT NULL DEFAULT '',
      recovery_expires_at TEXT NOT NULL DEFAULT '',
      recovery_attempts INTEGER NOT NULL DEFAULT 0,
      recovery_requested_at TEXT NOT NULL DEFAULT '',
      recovery_daily_date TEXT NOT NULL DEFAULT '',
      recovery_daily_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_settlement_sessions (
      token_hash TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      revoked_at TEXT NOT NULL DEFAULT ''
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_partner_settlement_sessions_owner_expiry
    ON partner_settlement_sessions(owner_id, expires_at)
  `).run();
}

export async function partnerAuthSession(request, env, input = {}) {
  await ensurePartnerSecuritySchema(env.DB);
  const cookieSession = cookieValue(request.headers.get('Cookie') || '', PARTNER_AUTH_COOKIE);
  const authorization = String(request.headers.get('Authorization') || '').trim();
  const bearer = authorization.replace(/^Bearer\s+/i, '');
  const session = String(input.session || request.headers.get('X-Inlet-Session') || bearer || cookieSession || '').trim();
  if (!session) throw partnerSecurityError('로그인이 필요합니다.', 401, 'PARTNER_LOGIN_REQUIRED');
  const { user, payload } = await getSessionAccount(request, env, { session });
  const ownerId = String(user.ownerId || user.id || payload.ownerId || '').trim();
  if (!ownerId) throw partnerSecurityError('계정 정보를 확인할 수 없습니다.', 401, 'PARTNER_ACCOUNT_INVALID');
  return { user, payload, ownerId, session };
}

export async function passwordPartnerLogin(input = {}, env = {}) {
  await ensurePartnerSecuritySchema(env.DB);
  const result = await loginAccount({
    email: input.email || '',
    password: input.password || '',
    role: 'master',
    projectId: '',
  }, env);
  const ownerId = String(result.user?.ownerId || result.user?.id || '').trim();
  if (!ownerId) throw authError('Account session is invalid.', 401, { code: 'PARTNER_ACCOUNT_INVALID' });
  await revokeSettlementSessions(env.DB, ownerId);
  return result;
}

export async function exchangePartnerSession(request, env, input = {}) {
  const auth = await partnerAuthSession(request, env, input);
  await revokeSettlementSessions(env.DB, auth.ownerId);
  return auth;
}

export function partnerAuthCookie(session = '', request = null) {
  return cookieHeader(PARTNER_AUTH_COOKIE, session, {
    maxAge: 30 * 24 * 60 * 60,
    request,
  });
}

export function clearPartnerAuthCookie(request = null) {
  return cookieHeader(PARTNER_AUTH_COOKIE, '', { maxAge: 0, request });
}

export function clearPartnerStepupCookie(request = null) {
  return cookieHeader(PARTNER_STEPUP_COOKIE, '', { maxAge: 0, request });
}

export async function partnerSecurityStatus(request, env) {
  const auth = await partnerAuthSession(request, env);
  const row = await getTotpRow(env.DB, auth.ownerId);
  const stepup = await validStepupSession(request, env.DB, auth.ownerId);
  return {
    ...auth,
    totpEnrolled: !!String(row?.enabled_at || ''),
    settlementVerified: !!stepup,
    lockedUntil: activeLockUntil(row),
  };
}

export async function startTotpEnrollment(request, env) {
  const auth = await partnerAuthSession(request, env);
  assertTotpEncryptionConfigured(env);
  const row = await getTotpRow(env.DB, auth.ownerId);
  if (String(row?.enabled_at || '')) {
    throw partnerSecurityError('이미 인증 앱이 등록되어 있습니다.', 409, 'PARTNER_TOTP_ALREADY_ENROLLED');
  }

  const secret = base32Encode(randomBytes(20));
  const encrypted = await encryptSecret(secret, env);
  await env.DB.prepare(`
    INSERT INTO partner_totp_security (
      owner_id, pending_secret_ciphertext, pending_secret_iv, updated_at
    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id) DO UPDATE SET
      pending_secret_ciphertext = excluded.pending_secret_ciphertext,
      pending_secret_iv = excluded.pending_secret_iv,
      failed_attempts = 0,
      locked_until = '',
      updated_at = CURRENT_TIMESTAMP
  `).bind(auth.ownerId, encrypted.ciphertext, encrypted.iv).run();

  const email = String(auth.user.email || '').trim().toLowerCase();
  const label = email ? `CallTag:${email}` : `CallTag:${auth.ownerId}`;
  const otpauthUri = `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent('CallTag')}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
  return {
    ownerId: auth.ownerId,
    email,
    manualSecret: secret,
    otpauthUri,
  };
}

export async function enableTotp(request, env, input = {}) {
  const auth = await partnerAuthSession(request, env);
  const row = await getTotpRow(env.DB, auth.ownerId);
  if (!row?.pending_secret_ciphertext || !row?.pending_secret_iv) {
    throw partnerSecurityError('먼저 인증 앱 등록을 시작해주세요.', 409, 'PARTNER_TOTP_SETUP_REQUIRED');
  }
  if (String(row.enabled_at || '')) {
    throw partnerSecurityError('이미 인증 앱이 등록되어 있습니다.', 409, 'PARTNER_TOTP_ALREADY_ENROLLED');
  }
  assertNotLocked(row);

  const code = normalizeTotpCode(input.code);
  const secret = await decryptSecret(row.pending_secret_ciphertext, row.pending_secret_iv, env);
  const match = await verifyTotpCode(secret, code, -1);
  if (!match.ok) {
    await recordTotpFailure(env.DB, auth.ownerId, row);
    throw partnerSecurityError('인증 코드가 올바르지 않습니다.', 403, 'PARTNER_TOTP_INVALID');
  }

  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE partner_totp_security
    SET secret_ciphertext = pending_secret_ciphertext,
        secret_iv = pending_secret_iv,
        pending_secret_ciphertext = '',
        pending_secret_iv = '',
        enabled_at = ?,
        last_used_counter = ?,
        failed_attempts = 0,
        locked_until = '',
        recovery_code_hash = '',
        recovery_expires_at = '',
        recovery_attempts = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE owner_id = ?
  `).bind(now, match.counter, auth.ownerId).run();

  const stepup = await createStepupSession(env.DB, auth.ownerId);
  return { auth, enabledAt: now, stepup };
}

export async function verifyPartnerTotp(request, env, input = {}) {
  const auth = await partnerAuthSession(request, env);
  const row = await getTotpRow(env.DB, auth.ownerId);
  if (!row?.enabled_at || !row.secret_ciphertext || !row.secret_iv) {
    throw partnerSecurityError('인증 앱 등록이 필요합니다.', 428, 'PARTNER_TOTP_ENROLLMENT_REQUIRED');
  }
  assertNotLocked(row);

  const code = normalizeTotpCode(input.code);
  const secret = await decryptSecret(row.secret_ciphertext, row.secret_iv, env);
  const lastCounter = Number.isFinite(Number(row.last_used_counter)) ? Number(row.last_used_counter) : -1;
  const match = await verifyTotpCode(secret, code, lastCounter);
  if (!match.ok) {
    await recordTotpFailure(env.DB, auth.ownerId, row);
    throw partnerSecurityError('인증 코드가 올바르지 않습니다.', 403, 'PARTNER_TOTP_INVALID');
  }

  await env.DB.prepare(`
    UPDATE partner_totp_security
    SET last_used_counter = ?, failed_attempts = 0, locked_until = '', updated_at = CURRENT_TIMESTAMP
    WHERE owner_id = ?
  `).bind(match.counter, auth.ownerId).run();
  const stepup = await createStepupSession(env.DB, auth.ownerId);
  return { auth, stepup };
}

export async function requireSettlementStepup(request, env) {
  const auth = await partnerAuthSession(request, env);
  const row = await getTotpRow(env.DB, auth.ownerId);
  if (!String(row?.enabled_at || '')) {
    throw partnerSecurityError('인증 앱 등록이 필요합니다.', 428, 'PARTNER_TOTP_ENROLLMENT_REQUIRED');
  }
  const session = await validStepupSession(request, env.DB, auth.ownerId);
  if (!session) throw partnerSecurityError('정산 2차 인증이 필요합니다.', 401, 'PARTNER_TOTP_REQUIRED');
  return { ...auth, settlementSession: session };
}

export async function startTotpRecovery(request, env) {
  const auth = await partnerAuthSession(request, env);
  const row = await getTotpRow(env.DB, auth.ownerId);
  if (!String(row?.enabled_at || '')) {
    throw partnerSecurityError('등록된 인증 앱이 없습니다.', 409, 'PARTNER_TOTP_NOT_ENROLLED');
  }
  const email = String(auth.user.email || '').trim().toLowerCase();
  if (!email) throw partnerSecurityError('복구 이메일을 확인할 수 없습니다.', 409, 'PARTNER_RECOVERY_EMAIL_REQUIRED');

  const now = Date.now();
  const lastRequested = Date.parse(String(row.recovery_requested_at || ''));
  if (Number.isFinite(lastRequested) && now - lastRequested < 60_000) {
    throw partnerSecurityError('복구 메일을 너무 자주 요청했습니다.', 429, 'PARTNER_RECOVERY_COOLDOWN', { retryAfterSeconds: 60 });
  }
  const today = new Date(now).toISOString().slice(0, 10);
  const sameDay = String(row.recovery_daily_date || '') === today;
  const dailyCount = sameDay ? Math.max(0, Number(row.recovery_daily_count || 0)) : 0;
  if (dailyCount >= RECOVERY_DAILY_LIMIT) {
    throw partnerSecurityError('오늘 가능한 복구 메일 요청 횟수를 초과했습니다.', 429, 'PARTNER_RECOVERY_DAILY_LIMIT');
  }

  const code = sixDigitCode();
  const expiresAt = new Date(now + RECOVERY_TTL_SECONDS * 1000).toISOString();
  const codeHash = await recoveryCodeHash(auth.ownerId, email, code, env);
  await env.DB.prepare(`
    UPDATE partner_totp_security
    SET recovery_code_hash = ?,
        recovery_expires_at = ?,
        recovery_attempts = 0,
        recovery_requested_at = ?,
        recovery_daily_date = ?,
        recovery_daily_count = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE owner_id = ?
  `).bind(codeHash, expiresAt, new Date(now).toISOString(), today, dailyCount + 1, auth.ownerId).run();

  try {
    await sendAuthVerificationEmail({ email, token: code, expiresAt, purpose: 'settlement-recovery' }, env);
  } catch (error) {
    await env.DB.prepare(`
      UPDATE partner_totp_security
      SET recovery_code_hash = '', recovery_expires_at = '', recovery_attempts = 0, updated_at = CURRENT_TIMESTAMP
      WHERE owner_id = ? AND recovery_code_hash = ?
    `).bind(auth.ownerId, codeHash).run();
    throw partnerSecurityError('복구 이메일 발송에 실패했습니다.', 503, String(error?.code || 'PARTNER_RECOVERY_EMAIL_FAILED'));
  }

  return { auth, email: maskEmail(email), expiresAt };
}

export async function recoverTotpByEmail(request, env, input = {}) {
  const auth = await partnerAuthSession(request, env);
  const row = await getTotpRow(env.DB, auth.ownerId);
  if (!String(row?.enabled_at || '')) {
    throw partnerSecurityError('등록된 인증 앱이 없습니다.', 409, 'PARTNER_TOTP_NOT_ENROLLED');
  }
  const code = normalizeTotpCode(input.code);
  const expiresAt = Date.parse(String(row.recovery_expires_at || ''));
  if (!row.recovery_code_hash || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw partnerSecurityError('복구 코드가 만료되었습니다.', 410, 'PARTNER_RECOVERY_EXPIRED');
  }
  if (Number(row.recovery_attempts || 0) >= 5) {
    throw partnerSecurityError('복구 코드 입력 횟수를 초과했습니다.', 429, 'PARTNER_RECOVERY_BLOCKED');
  }
  const email = String(auth.user.email || '').trim().toLowerCase();
  const expected = await recoveryCodeHash(auth.ownerId, email, code, env);
  if (!constantTimeTextEqual(expected, String(row.recovery_code_hash || ''))) {
    await env.DB.prepare(`
      UPDATE partner_totp_security
      SET recovery_attempts = recovery_attempts + 1, updated_at = CURRENT_TIMESTAMP
      WHERE owner_id = ?
    `).bind(auth.ownerId).run();
    throw partnerSecurityError('복구 코드가 올바르지 않습니다.', 403, 'PARTNER_RECOVERY_INVALID');
  }

  await clearTotpForOwner(env.DB, auth.ownerId);
  return { auth, reset: true };
}

export async function adminResetPartnerTotp(db, ownerId = '') {
  await ensurePartnerSecuritySchema(db);
  const safeOwnerId = String(ownerId || '').trim();
  if (!safeOwnerId) throw partnerSecurityError('회원 식별자가 필요합니다.', 400, 'PARTNER_OWNER_ID_REQUIRED');
  const row = await getTotpRow(db, safeOwnerId);
  const wasEnrolled = !!String(row?.enabled_at || '');
  await clearTotpForOwner(db, safeOwnerId);
  return { ownerId: safeOwnerId, wasEnrolled, reset: true };
}

export async function partnerTotpAdminStatus(db, ownerId = '') {
  await ensurePartnerSecuritySchema(db);
  const row = await getTotpRow(db, ownerId);
  return {
    enrolled: !!String(row?.enabled_at || ''),
    enabledAt: safeIso(row?.enabled_at),
    lockedUntil: activeLockUntil(row),
  };
}

export async function revokeSettlementSessions(db, ownerId = '') {
  if (!db?.prepare || !ownerId) return;
  await ensurePartnerSecuritySchema(db);
  await db.prepare(`
    UPDATE partner_settlement_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE owner_id = ? AND revoked_at = ''
  `).bind(ownerId).run();
}

async function clearTotpForOwner(db, ownerId) {
  await ensurePartnerSecuritySchema(db);
  await db.prepare(`
    INSERT INTO partner_totp_security (owner_id, created_at, updated_at)
    VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id) DO UPDATE SET
      secret_ciphertext = '',
      secret_iv = '',
      pending_secret_ciphertext = '',
      pending_secret_iv = '',
      enabled_at = '',
      last_used_counter = -1,
      failed_attempts = 0,
      locked_until = '',
      recovery_code_hash = '',
      recovery_expires_at = '',
      recovery_attempts = 0,
      updated_at = CURRENT_TIMESTAMP
  `).bind(ownerId).run();
  await revokeSettlementSessions(db, ownerId);
}

async function getTotpRow(db, ownerId) {
  await ensurePartnerSecuritySchema(db);
  return db.prepare(`
    SELECT owner_id, secret_ciphertext, secret_iv, pending_secret_ciphertext, pending_secret_iv,
           enabled_at, last_used_counter, failed_attempts, locked_until,
           recovery_code_hash, recovery_expires_at, recovery_attempts, recovery_requested_at,
           recovery_daily_date, recovery_daily_count, created_at, updated_at
    FROM partner_totp_security
    WHERE owner_id = ?
    LIMIT 1
  `).bind(ownerId).first();
}

async function createStepupSession(db, ownerId) {
  await ensurePartnerSecuritySchema(db);
  const token = bytesToBase64Url(randomBytes(32));
  const tokenHash = await sha256Hex(`partner-settlement-session:v1:${token}`);
  const expiresAt = new Date(Date.now() + STEPUP_TTL_SECONDS * 1000).toISOString();
  await db.prepare(`DELETE FROM partner_settlement_sessions WHERE datetime(expires_at) <= CURRENT_TIMESTAMP OR revoked_at <> ''`).run();
  await db.prepare(`
    INSERT INTO partner_settlement_sessions (token_hash, owner_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(tokenHash, ownerId, expiresAt).run();
  return { token, expiresAt };
}

async function validStepupSession(request, db, ownerId) {
  await ensurePartnerSecuritySchema(db);
  const token = cookieValue(request.headers.get('Cookie') || '', PARTNER_STEPUP_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(`partner-settlement-session:v1:${token}`);
  const row = await db.prepare(`
    SELECT token_hash, owner_id, expires_at
    FROM partner_settlement_sessions
    WHERE token_hash = ? AND owner_id = ? AND revoked_at = '' AND datetime(expires_at) > CURRENT_TIMESTAMP
    LIMIT 1
  `).bind(tokenHash, ownerId).first();
  return row?.token_hash ? row : null;
}

export function partnerStepupCookie(stepup = {}, request = null) {
  return cookieHeader(PARTNER_STEPUP_COOKIE, stepup.token || '', {
    maxAge: STEPUP_TTL_SECONDS,
    request,
  });
}

function cookieHeader(name, value, options = {}) {
  const secure = isHttpsRequest(options.request) ? '; Secure' : '';
  const maxAge = Math.max(0, Math.trunc(Number(options.maxAge || 0)));
  return `${name}=${encodeURIComponent(String(value || ''))}; Path=/api/partner; HttpOnly${secure}; SameSite=Strict; Max-Age=${maxAge}`;
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

function isHttpsRequest(request) {
  try { return new URL(request?.url || 'https://calltag.pagero.kr/').protocol === 'https:'; } catch { return true; }
}

function normalizeTotpCode(value = '') {
  const code = String(value || '').replace(/\D/g, '').slice(0, 6);
  if (!/^\d{6}$/.test(code)) throw partnerSecurityError('6자리 인증 코드를 입력해주세요.', 400, 'PARTNER_TOTP_CODE_REQUIRED');
  return code;
}

function assertNotLocked(row = {}) {
  const lockedUntil = Date.parse(String(row.locked_until || ''));
  if (Number.isFinite(lockedUntil) && lockedUntil > Date.now()) {
    throw partnerSecurityError('인증 시도가 잠시 제한되었습니다.', 429, 'PARTNER_TOTP_LOCKED', {
      lockedUntil: new Date(lockedUntil).toISOString(),
    });
  }
}

function activeLockUntil(row = {}) {
  const parsed = Date.parse(String(row?.locked_until || ''));
  return Number.isFinite(parsed) && parsed > Date.now() ? new Date(parsed).toISOString() : '';
}

async function recordTotpFailure(db, ownerId, row = {}) {
  const attempts = Math.max(0, Number(row.failed_attempts || 0)) + 1;
  const lockedUntil = attempts >= TOTP_LOCK_AFTER
    ? new Date(Date.now() + TOTP_LOCK_SECONDS * 1000).toISOString()
    : '';
  await db.prepare(`
    UPDATE partner_totp_security
    SET failed_attempts = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP
    WHERE owner_id = ?
  `).bind(attempts, lockedUntil, ownerId).run();
}

async function verifyTotpCode(secret, code, lastUsedCounter = -1) {
  const currentCounter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const counter = currentCounter + offset;
    if (counter <= lastUsedCounter) continue;
    const expected = await totpAtCounter(secret, counter);
    if (constantTimeTextEqual(expected, code)) return { ok: true, counter };
  }
  return { ok: false, counter: -1 };
}

async function totpAtCounter(secret, counter) {
  const keyBytes = base32Decode(secret);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const counterBytes = new Uint8Array(8);
  let value = BigInt(counter);
  for (let index = 7; index >= 0; index -= 1) {
    counterBytes[index] = Number(value & 0xffn);
    value >>= 8n;
  }
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

function assertTotpEncryptionConfigured(env = {}) {
  const configured = String(env.PARTNER_TOTP_ENCRYPTION_KEY || env.TOTP_ENCRYPTION_KEY || '').trim();
  if (configured.length < 32) {
    throw partnerSecurityError('TOTP 암호화 키 설정이 필요합니다.', 503, 'PARTNER_TOTP_ENCRYPTION_KEY_REQUIRED');
  }
  return configured;
}

async function encryptionKey(env = {}) {
  const configured = assertTotpEncryptionConfigured(env);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`calltag-partner-totp:v1:${configured}`));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptSecret(secret, env) {
  const iv = randomBytes(12);
  const key = await encryptionKey(env);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret));
  return { ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)), iv: bytesToBase64Url(iv) };
}

async function decryptSecret(ciphertext, iv, env) {
  try {
    const key = await encryptionKey(env);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlToBytes(iv) },
      key,
      base64UrlToBytes(ciphertext),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw partnerSecurityError('인증 앱 보안정보를 확인할 수 없습니다.', 503, 'PARTNER_TOTP_SECRET_DECRYPT_FAILED');
  }
}

async function recoveryCodeHash(ownerId, email, code, env = {}) {
  const key = assertTotpEncryptionConfigured(env);
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${authSecret(env)}:${key}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(`partner-totp-recovery:v1:${ownerId}:${email}:${code}`));
  return bytesToHex(new Uint8Array(digest));
}

function sixDigitCode() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(random[0] % 1_000_000).padStart(6, '0');
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base32Encode(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value = '') {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) continue;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value = '') {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256Hex(value = '') {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeTextEqual(leftValue = '', rightValue = '') {
  const left = String(leftValue || '');
  const right = String(rightValue || '');
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function maskEmail(value = '') {
  const email = String(value || '').trim().toLowerCase();
  const at = email.indexOf('@');
  if (at <= 0) return '';
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}${'*'.repeat(Math.max(3, Math.min(6, local.length - 2)))}${email.slice(at)}`;
}

function safeIso(value = '') {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}
