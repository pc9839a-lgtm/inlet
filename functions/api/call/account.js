import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { AUTH_METHODS } from '../auth/_auth.js';
import { callSession, entitlementPublic, getCallEntitlement, profilePublic, upsertCallProfile } from './_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (!['GET', 'PATCH'].includes(request.method)) return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
    const input = request.method === 'PATCH' ? await readJson(request) : {};
    const current = await callSession(request, env, input);
    let profile = current.profile;
    if (request.method === 'PATCH') {
      const row = await upsertCallProfile(env.DB, {
        ownerId: current.ownerId,
        email: current.user.email,
        name: input.name || current.profile.name,
        phone: input.phone || current.profile.phone,
        brandName: input.brandName || current.profile.brandName,
        industry: input.industry || current.profile.industry,
      });
      profile = profilePublic(row, current.user);
    }
    const entitlement = await getCallEntitlement(env.DB, current.ownerId);
    return jsonResponse(request, env, 200, {
      ok: true,
      user: current.user,
      profile,
      entitlement: entitlementPublic(entitlement),
    }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
