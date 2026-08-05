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
const PLAY_REVIEW_BOOTSTRAP_SHA256 = '909debd7553070cc0ede6decb705e32349c2d14a2cc29cda2931e99a5b66997f';

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

function generateReviewerPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(28);
  crypto.getRandomValues(bytes);
  let value = 'CtRv-';
  for (const byte of bytes) value += alphabet[byte % alphabet.length];
  return value;
}

async function claimBootstrapToken(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS internal_one_time_operations (
      operation_key TEXT PRIMARY KEY,
      completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  const result = await db.prepare(`
    INSERT INTO internal_one_time_operations (operation_key, completed_at)
    VALUES (?, CURRENT_TIMESTAMP)
    ON CONFLICT(operation_key) DO NOTHING
  `).bind(`play-review:${PLAY_REVIEW_BOOTSTRAP_SHA256}`).run();
  return Number(result?.meta?.changes || 0) === 1;
}

async function provisionPlayReviewAccount(password = '', env = {}) {
  const email = PLAY_REVIEW_EMAIL;
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
    passwordHash: await passwordHash(password, email, env),
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
  return { email };
}

async function handleBootstrap(request, env) {
  const url = new URL(request.url);
  const suppliedKey = String(url.searchParams.get('key') || '');
  const suppliedDigest = await sha256Hex(suppliedKey);
  if (!constantTimeEqual(suppliedDigest, PLAY_REVIEW_BOOTSTRAP_SHA256)) {
    return jsonResponse(request, env, 404, { ok: false, error: 'Not found.' }, AUTH_METHODS);
  }
  if (!await claimBootstrapToken(env.DB)) {
    return jsonResponse(request, env, 409, { ok: false, error: 'Operation already completed.' }, AUTH_METHODS);
  }
  const password = generateReviewerPassword();
  const account = await provisionPlayReviewAccount(password, env);
  return jsonResponse(request, env, 200, {
    ok: true,
    email: account.email,
    password,
    access: 'full',
  }, AUTH_METHODS);
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  try {
    assertD1(env);
    if (request.method === 'GET') return handleBootstrap(request, env);
    if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);

    const input = await readJson(request);
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
