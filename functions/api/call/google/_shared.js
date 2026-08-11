import { getD1AccountByEmail, upsertD1Account } from '../../../../server/storage/d1Adapter.mjs';
import {
  authSecret,
  authUserPublic,
  createSessionToken,
  normalizeEmail,
  ownerIdForEmail,
} from '../../auth/_auth.js';
import {
  ensurePendingEntitlement,
  entitlementPublic,
  getCallProfile,
  profilePublic,
} from '../_shared.js';

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const TICKET_TTL_MS = 2 * 60 * 1000;
const STATE_TTL_SECONDS = 10 * 60;

export function googleLoginConfigured(env = {}) {
  return !!(googleClientId(env) && googleClientSecret(env));
}

export function googleClientId(env = {}) {
  return String(env.GOOGLE_LOGIN_CLIENT_ID || env.GOOGLE_CLIENT_ID || '').trim();
}

export function googleClientSecret(env = {}) {
  return String(env.GOOGLE_LOGIN_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || '').trim();
}

export function googleRedirectUri(env = {}) {
  return String(
    env.GOOGLE_LOGIN_REDIRECT_URI
      || 'https://pagero.kr/api/call/google/callback'
  ).trim();
}

export async function googleAuthorizationUrl(env = {}, input = {}) {
  if (!googleLoginConfigured(env)) {
    throw oauthError('Google 로그인 운영 설정이 필요합니다.', 503, 'GOOGLE_LOGIN_NOT_CONFIGURED');
  }
  const state = await signedState({
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    nonce: crypto.randomUUID(),
    returnScheme: safeReturnScheme(input.returnScheme),
  }, env);
  const params = new URLSearchParams({
    client_id: googleClientId(env),
    redirect_uri: googleRedirectUri(env),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    access_type: 'online',
    include_granted_scopes: 'true',
  });
  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export async function verifyGoogleState(value = '', env = {}) {
  const [payloadPart, signaturePart] = String(value || '').split('.');
  if (!payloadPart || !signaturePart) throw oauthError('Google 로그인 요청이 올바르지 않습니다.', 400, 'GOOGLE_STATE_INVALID');
  const expected = await hmacBase64Url(payloadPart, authSecret(env));
  if (!constantTimeEqual(expected, signaturePart)) throw oauthError('Google 로그인 요청이 올바르지 않습니다.', 400, 'GOOGLE_STATE_INVALID');
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadPart));
  } catch {
    throw oauthError('Google 로그인 요청이 올바르지 않습니다.', 400, 'GOOGLE_STATE_INVALID');
  }
  if (Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) {
    throw oauthError('Google 로그인 요청이 만료되었습니다.', 410, 'GOOGLE_STATE_EXPIRED');
  }
  return payload;
}

export async function exchangeGoogleCode(code = '', env = {}) {
  if (!googleLoginConfigured(env)) throw oauthError('Google 로그인 운영 설정이 필요합니다.', 503, 'GOOGLE_LOGIN_NOT_CONFIGURED');
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(code || '').trim(),
      client_id: googleClientId(env),
      client_secret: googleClientSecret(env),
      redirect_uri: googleRedirectUri(env),
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw oauthError('Google 인증 정보를 확인하지 못했습니다.', 401, 'GOOGLE_CODE_EXCHANGE_FAILED');
  }

  const userResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${body.access_token}` },
    signal: AbortSignal.timeout(15000),
  });
  const profile = await userResponse.json().catch(() => ({}));
  const email = normalizeEmail(profile.email || '');
  if (!userResponse.ok || !email || profile.email_verified !== true) {
    throw oauthError('인증된 Google 이메일을 확인하지 못했습니다.', 401, 'GOOGLE_EMAIL_NOT_VERIFIED');
  }
  return {
    email,
    name: String(profile.name || profile.given_name || email).trim(),
    subject: String(profile.sub || '').trim(),
  };
}

export async function findOrCreateGoogleAccount(db, googleProfile = {}) {
  const email = normalizeEmail(googleProfile.email || '');
  if (!email) throw oauthError('Google 이메일을 확인하지 못했습니다.', 400, 'GOOGLE_EMAIL_REQUIRED');
  const existing = await getD1AccountByEmail(db, email);
  if (existing) {
    if (String(existing.status || 'active') !== 'active') {
      throw oauthError('사용할 수 없는 계정입니다.', 403, 'AUTH_ACCOUNT_UNAVAILABLE');
    }
    const updated = await upsertD1Account(db, {
      ...existing,
      id: existing.id || existing.ownerId || ownerIdForEmail(email),
      ownerId: existing.ownerId || existing.id || ownerIdForEmail(email),
      email,
      name: existing.name || googleProfile.name || email,
      emailVerified: true,
      updatedAt: new Date().toISOString(),
    });
    return authUserPublic(updated);
  }

  const now = new Date().toISOString();
  const ownerId = ownerIdForEmail(email);
  const created = await upsertD1Account(db, {
    id: ownerId,
    ownerId,
    name: googleProfile.name || email,
    email,
    phone: '',
    phoneVerified: false,
    emailVerified: true,
    passwordHash: '',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  return authUserPublic(created);
}

export async function createGoogleLoginTicket(db, user = {}) {
  await ensureGoogleTicketSchema(db);
  const ticket = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
  const expiresAt = Date.now() + TICKET_TTL_MS;
  await db.prepare(`
    INSERT INTO call_google_login_tickets (ticket, owner_id, email, expires_at, used_at, created_at)
    VALUES (?, ?, ?, ?, '', CURRENT_TIMESTAMP)
  `).bind(ticket, user.ownerId || user.id || '', normalizeEmail(user.email || ''), expiresAt).run();
  return ticket;
}

export async function consumeGoogleLoginTicket(db, ticket = '', env = {}) {
  await ensureGoogleTicketSchema(db);
  const safeTicket = String(ticket || '').trim();
  if (!safeTicket) throw oauthError('Google 로그인 확인값이 없습니다.', 400, 'GOOGLE_TICKET_REQUIRED');
  const row = await db.prepare(`
    SELECT ticket, owner_id, email, expires_at, used_at
    FROM call_google_login_tickets
    WHERE ticket = ?
    LIMIT 1
  `).bind(safeTicket).first();
  if (!row || row.used_at) throw oauthError('Google 로그인 확인값이 올바르지 않습니다.', 401, 'GOOGLE_TICKET_INVALID');
  if (Number(row.expires_at || 0) < Date.now()) {
    throw oauthError('Google 로그인 확인값이 만료되었습니다.', 410, 'GOOGLE_TICKET_EXPIRED');
  }
  const result = await db.prepare(`
    UPDATE call_google_login_tickets
    SET used_at = CURRENT_TIMESTAMP
    WHERE ticket = ? AND used_at = ''
  `).bind(safeTicket).run();
  if (Number(result?.meta?.changes || 0) !== 1) {
    throw oauthError('이미 사용된 Google 로그인 확인값입니다.', 409, 'GOOGLE_TICKET_USED');
  }

  const account = await getD1AccountByEmail(db, normalizeEmail(row.email || ''));
  if (!account || String(account.ownerId || account.id || '') !== String(row.owner_id || '')) {
    throw oauthError('Google 로그인 계정을 찾지 못했습니다.', 404, 'GOOGLE_ACCOUNT_NOT_FOUND');
  }
  const user = authUserPublic(account);
  const profile = await getCallProfile(db, user.ownerId);
  const entitlement = await ensurePendingEntitlement(db, user.ownerId);
  const session = await createSessionToken({
    ownerId: user.ownerId,
    projectId: 'calllink',
    role: 'calllink_user',
    email: user.email,
  }, env);
  const publicProfile = profilePublic(profile, user);
  return {
    ok: true,
    user,
    profile: publicProfile,
    entitlement: entitlementPublic(entitlement),
    session,
    profileRequired: !publicProfile.phone || !publicProfile.brandName || !publicProfile.industry,
  };
}

export function googleAppRedirect(state = {}, values = {}) {
  const scheme = safeReturnScheme(state.returnScheme);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values || {})) {
    if (value !== undefined && value !== null && String(value) !== '') params.set(key, String(value));
  }
  return `${scheme}://auth/google?${params.toString()}`;
}

export function oauthError(message, status = 400, code = 'GOOGLE_LOGIN_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.details = { code };
  return error;
}

async function ensureGoogleTicketSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS call_google_login_tickets (
      ticket TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      email TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    DELETE FROM call_google_login_tickets
    WHERE expires_at < ? OR used_at != ''
  `).bind(Date.now() - 24 * 60 * 60 * 1000).run();
}

async function signedState(payload = {}, env = {}) {
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  return `${payloadPart}.${await hmacBase64Url(payloadPart, authSecret(env))}`;
}

async function hmacBase64Url(value = '', secret = '') {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(String(secret || '')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(String(value || '')));
  return bytesToBase64Url(new Uint8Array(signature));
}

function safeReturnScheme(value = '') {
  return String(value || '').trim().toLowerCase() === 'calltag' ? 'calltag' : 'calltag';
}

function constantTimeEqual(left = '', right = '') {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function base64UrlEncode(value = '') {
  return bytesToBase64Url(new TextEncoder().encode(String(value || '')));
}

function base64UrlDecode(value = '') {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return decodeURIComponent(Array.from(atob(padded), (char) =>
    `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
