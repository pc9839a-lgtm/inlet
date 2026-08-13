import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import { PARTNER_SECURITY_METHODS, startTotpEnrollment } from '../_security.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, PARTNER_SECURITY_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, PARTNER_SECURITY_METHODS);
  try {
    assertD1(env);
    const setup = await startTotpEnrollment(request, env);
    return jsonResponse(request, env, 200, { ok: true, ...setup }, PARTNER_SECURITY_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_SECURITY_METHODS);
  }
}
