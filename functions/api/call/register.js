import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { AUTH_METHODS, createSessionToken, registerAccount } from '../auth/_auth.js';
import { ensurePendingEntitlement, entitlementPublic, profilePublic, upsertCallProfile } from './_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
    const input = await readJson(request);
    const user = await registerAccount({
      name: input.name,
      phone: input.phone,
      email: input.email,
      password: input.password,
      token: input.token || input.verificationToken,
      source: 'calllink_app',
    }, env);
    const profile = await upsertCallProfile(env.DB, {
      ownerId: user.ownerId,
      email: user.email,
      name: input.name,
      phone: input.phone,
      brandName: input.brandName,
      industry: input.industry,
    });
    const entitlement = await ensurePendingEntitlement(env.DB, user.ownerId);
    const session = await createSessionToken({
      ownerId: user.ownerId,
      projectId: 'calllink',
      role: 'calllink_user',
      email: user.email,
    }, env);
    return jsonResponse(request, env, 200, {
      ok: true,
      user,
      profile: profilePublic(profile, user),
      entitlement: entitlementPublic(entitlement),
      session,
    }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
