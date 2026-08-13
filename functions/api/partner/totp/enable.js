import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { PARTNER_SECURITY_METHODS, enableTotp, partnerStepupCookie } from '../_security.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, PARTNER_SECURITY_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, PARTNER_SECURITY_METHODS);
  try {
    assertD1(env);
    const input = await readJson(request);
    const result = await enableTotp(request, env, input);
    return jsonResponse(request, env, 200, {
      ok: true,
      totpEnrolled: true,
      settlementVerified: true,
      enabledAt: result.enabledAt,
      expiresAt: result.stepup.expiresAt,
    }, PARTNER_SECURITY_METHODS, {
      headers: { 'Set-Cookie': partnerStepupCookie(result.stepup, request) },
    });
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_SECURITY_METHODS);
  }
}
