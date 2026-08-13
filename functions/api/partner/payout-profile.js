import { handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import {
  PARTNER_PORTAL_METHODS,
  partnerPortalContext,
  readPayoutProfile,
  savePayoutProfile,
} from './_portal.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, PARTNER_PORTAL_METHODS);
  try {
    const context = await partnerPortalContext(request, env);
    if (request.method === 'GET') {
      const profile = await readPayoutProfile(context.db, context.ownerId, context.user);
      return jsonResponse(request, env, 200, { ok: true, ...profile }, PARTNER_PORTAL_METHODS);
    }
    if (request.method === 'PUT') {
      const input = await readJson(request);
      const profile = await savePayoutProfile(context.db, context.ownerId, input, env);
      return jsonResponse(request, env, 200, { ok: true, ...profile }, PARTNER_PORTAL_METHODS);
    }
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, PARTNER_PORTAL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_PORTAL_METHODS);
  }
}
