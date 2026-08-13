import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { createSessionToken } from '../../auth/_auth.js';
import {
  ensurePendingEntitlement,
  entitlementPublic,
  getCallProfile,
  profilePublic,
} from '../_shared.js';
import {
  findOrCreateGoogleAccount,
  googleClientId,
  oauthError,
} from './_shared.js';

const METHODS = 'POST, OPTIONS';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const MAX_TOKEN_LENGTH = 16_384;
const MAX_NONCE_LENGTH = 256;
let jwksCache = { expiresAt: 0, keys: [] };

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    const input = await readJson(request);
    const idToken = String(input.idToken || '').trim();
    const nonce = String(input.nonce || '').trim();
    const legacyNative = input.legacyNative === true;
    const googleProfile = await verifyGoogleIdToken(idToken, nonce, env, legacyNative);
    const user = await findOrCreateGoogleAccount(db, googleProfile);
    const profile = await getCallProfile(db, user.ownerId);
    const entitlement = await ensurePendingEntitlement(db, user.ownerId);
    const session = await createSessionToken({
      ownerId: user.ownerId,
      projectId: 'calllink',
      role: 'calllink_user',
      email: user.email,
    }, env);
    const publicProfile = profilePublic(profile, user);

    return jsonResponse(request, env, 200, {
      ok: true,
      user,
      profile: publicProfile,
      entitlement: entitlementPublic(entitlement),
      session,
      profileRequired: !publicProfile.phone || !publicProfile.brandName || !publicProfile.industry,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}

async function verifyGoogleIdToken(idToken = '', expectedNonce = '', env = {}, legacyNative = false) {
  if (!idToken || idToken.length > MAX_TOKEN_LENGTH) {
    throw oauthError('Google 로그인 토큰이 올바르지 않습니다.', 400, 'GOOGLE_ID_TOKEN_INVALID');
  }
  if (!legacyNative && (!expectedNonce || expectedNonce.length > MAX_NONCE_LENGTH)) {
    throw oauthError('Google 로그인 요청값이 올바르지 않습니다.', 400, 'GOOGLE_NONCE_INVALID');
  }
  if (legacyNative && expectedNonce.length > MAX_NONCE_LENGTH) {
    throw oauthError('Google 로그인 요청값이 올바르지 않습니다.', 400, 'GOOGLE_NONCE_INVALID');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw oauthError('Google 로그인 토큰이 올바르지 않습니다.', 401, 'GOOGLE_ID_TOKEN_INVALID');
  }

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlText(parts[0]));
    payload = JSON.parse(base64UrlText(parts[1]));
  } catch {
    throw oauthError('Google 로그인 토큰이 올바르지 않습니다.', 401, 'GOOGLE_ID_TOKEN_INVALID');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw oauthError('지원하지 않는 Google 로그인 토큰입니다.', 401, 'GOOGLE_ID_TOKEN_ALG_INVALID');
  }

  const jwk = await googleJwk(header.kid);
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const verified = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    base64UrlBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!verified) {
    throw oauthError('Google 로그인 토큰 서명을 확인하지 못했습니다.', 401, 'GOOGLE_ID_TOKEN_SIGNATURE_INVALID');
  }

  const now = Math.floor(Date.now() / 1000);
  const audience = googleClientId(env);
  if (!audience || String(payload.aud || '') !== audience) {
    throw oauthError('Google 로그인 대상이 올바르지 않습니다.', 401, 'GOOGLE_ID_TOKEN_AUDIENCE_INVALID');
  }
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
    throw oauthError('Google 로그인 발급자를 확인하지 못했습니다.', 401, 'GOOGLE_ID_TOKEN_ISSUER_INVALID');
  }
  if (Number(payload.exp || 0) <= now || Number(payload.iat || 0) > now + 120) {
    throw oauthError('Google 로그인 토큰이 만료되었습니다.', 401, 'GOOGLE_ID_TOKEN_EXPIRED');
  }
  if (!legacyNative && String(payload.nonce || '') !== expectedNonce) {
    throw oauthError('Google 로그인 요청값이 일치하지 않습니다.', 401, 'GOOGLE_NONCE_MISMATCH');
  }
  if (payload.email_verified !== true || !String(payload.email || '').trim()) {
    throw oauthError('인증된 Google 이메일을 확인하지 못했습니다.', 401, 'GOOGLE_EMAIL_NOT_VERIFIED');
  }

  return {
    email: String(payload.email || '').trim().toLowerCase(),
    name: String(payload.name || payload.given_name || payload.email || '').trim(),
    subject: String(payload.sub || '').trim(),
  };
}

async function googleJwk(kid = '') {
  const now = Date.now();
  if (jwksCache.expiresAt <= now || !jwksCache.keys.length) {
    const fresh = await fetchGoogleJwks();
    jwksCache = {
      expiresAt: now + Math.max(60_000, fresh.maxAge * 1000),
      keys: fresh.keys,
    };
  }

  let key = jwksCache.keys.find((entry) => entry && entry.kid === kid);
  if (!key) {
    const fresh = await fetchGoogleJwks();
    jwksCache = {
      expiresAt: Date.now() + Math.max(60_000, fresh.maxAge * 1000),
      keys: fresh.keys,
    };
    key = jwksCache.keys.find((entry) => entry && entry.kid === kid);
  }
  if (!key) throw oauthError('Google 로그인 인증키가 올바르지 않습니다.', 401, 'GOOGLE_JWK_NOT_FOUND');
  return key;
}

async function fetchGoogleJwks() {
  let response;
  try {
    response = await fetch(GOOGLE_JWKS_URL, {
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    throw oauthError('Google 로그인 인증키 서버에 연결하지 못했습니다.', 503, 'GOOGLE_JWKS_NETWORK_FAILED');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(body.keys)) {
    throw oauthError('Google 로그인 인증키를 확인하지 못했습니다.', 503, 'GOOGLE_JWKS_UNAVAILABLE');
  }
  return {
    keys: body.keys,
    maxAge: cacheMaxAge(response.headers.get('cache-control')),
  };
}

function cacheMaxAge(value = '') {
  const match = String(value || '').match(/max-age=(\d+)/i);
  return match ? Number(match[1]) : 3600;
}

function base64UrlText(value = '') {
  return new TextDecoder().decode(base64UrlBytes(value));
}

function base64UrlBytes(value = '') {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
