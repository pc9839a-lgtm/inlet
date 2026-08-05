import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { AUTH_METHODS, loginAccount } from '../auth/_auth.js';
import { ensurePendingEntitlement, entitlementPublic, getCallProfile, profilePublic } from './_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
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
