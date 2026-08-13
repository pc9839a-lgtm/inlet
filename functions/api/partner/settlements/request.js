import { handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import {
  PARTNER_PORTAL_METHODS,
  createPayoutRequest,
  normalizeService,
  partnerPortalContext,
} from '../_portal.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, PARTNER_PORTAL_METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, PARTNER_PORTAL_METHODS);
  }
  try {
    const context = await partnerPortalContext(request, env);
    const input = await readJson(request);
    const service = normalizeService(input.service || 'ALL');
    const payoutRequest = await createPayoutRequest(context.db, context.ownerId, service);
    return jsonResponse(request, env, 201, { ok: true, request: payoutRequest }, PARTNER_PORTAL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_PORTAL_METHODS);
  }
}
