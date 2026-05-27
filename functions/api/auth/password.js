import { getD1AccountByEmail, upsertD1Account } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { AUTH_METHODS, assertAccountActive, authError, authUserPublic, isValidEmail, isValidPassword, normalizeEmail, passwordHash } from './_auth.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
    const input = await readJson(request);
    const email = normalizeEmail(input.email || '');
    const password = String(input.password || '');
    if (!isValidEmail(email)) throw authError('Valid email is required.', 400, { code: 'AUTH_EMAIL_REQUIRED' });
    if (input.emailVerified !== true) throw authError('Email verification is required before changing password.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });
    if (!isValidPassword(password)) throw authError('Password must include letters and numbers and be at least 6 characters.', 400, { code: 'AUTH_PASSWORD_POLICY' });
    const user = await getD1AccountByEmail(env.DB, email);
    if (!user) throw authError('Account was not found.', 404, { code: 'AUTH_ACCOUNT_NOT_FOUND' });
    assertAccountActive(user, 'change password');
    const updated = await upsertD1Account(env.DB, {
      ...user,
      passwordHash: await passwordHash(password, email, env),
      emailVerified: true,
      updatedAt: new Date().toISOString(),
    });
    return jsonResponse(request, env, 200, { ok: true, user: authUserPublic(updated) }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
