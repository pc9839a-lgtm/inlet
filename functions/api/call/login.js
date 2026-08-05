import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import {
  AUTH_METHODS,
  loginAccount,
  normalizeEmail,
  ownerIdForEmail,
  passwordHash,
} from '../auth/_auth.js';
import { upsertD1Account } from '../../../server/storage/d1Adapter.mjs';
import {
  ensurePendingEntitlement,
  entitlementPublic,
  getCallProfile,
  profilePublic,
  upsertCallProfile,
} from './_shared.js';

const PLAY_REVIEW_EMAIL = 'play-review@pagero.kr';
const PLAY_REVIEW_PASSWORD_SHA256 = 'c9c5733cdf4dc21a3dccac497202c272aaa2c3375b50e8070fa2553fbcdd0811';

async function sha256Hex(value = '') {
  const input = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left = '', right = '') {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

async function ensurePlayReviewAccount(input = {}, env = {}) {
  const email = normalizeEmail(input.email || '');
  if (email !== PLAY_REVIEW_EMAIL) return;

  const suppliedPassword = String(input.password || '');
  const suppliedDigest = await sha256Hex(suppliedPassword);
  if (!constantTimeEqual(suppliedDigest, PLAY_REVIEW_PASSWORD_SHA256)) return;

  const ownerId = ownerIdForEmail(email);
  const now = new Date().toISOString();
  await upsertD1Account(env.DB, {
    id: ownerId,
    ownerId,
    name: 'Google Play Reviewer',
    email,
    phone: '01090000001',
    phoneVerified: false,
    emailVerified: true,
    emailVerifiedAt: now,
    passwordHash: await passwordHash(suppliedPassword, email, env),
    status: 'active',
    source: 'google_play_review',
    createdAt: now,
    updatedAt: now,
  });
  await upsertCallProfile(env.DB, {
    ownerId,
    email,
    name: 'Google Play Reviewer',
    phone: '01090000001',
    brandName: 'CallTag Review',
    industry: 'Software',
  });
  await ensurePendingEntitlement(env.DB, ownerId);
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
    const input = await readJson(request);
    await ensurePlayReviewAccount(input, env);
    const result = await loginAccount({
      email: input.email,
      password: input.password,
      projectId: 'calllink',
      role: 'calllink_user',
    }, env);
    const ownerId = String(result.user?.ownerId || result.user?.id || '');
    const profile = await getCallProfile(env.DB, ownerId);
    const entitlement = await ensurePendingEntitlement(env.DB, ownerId);
    return jsonResponse(request, env, 200, {
      ok: true,
      user: result.user,
      profile: profilePublic(profile, result.user),
      entitlement: entitlementPublic(entitlement),
      session: result.session,
    }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
