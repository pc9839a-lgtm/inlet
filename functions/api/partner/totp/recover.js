import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { PARTNER_SECURITY_METHODS, clearPartnerStepupCookie, recoverTotpByEmail } from '../_security.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, PARTNER_SECURITY_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, PARTNER_SECURITY_METHODS);
  try {
    assertD1(env);
    const input = await readJson(request);
    await recoverTotpByEmail(request, env, input);
    return jsonResponse(request, env, 200, {
      ok: true,
      reset: true,
      totpEnrolled: false,
      settlementVerified: false,
    }, PARTNER_SECURITY_METHODS, {
      headers: { 'Set-Cookie': clearPartnerStepupCookie(request) },
    });
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_SECURITY_METHODS);
  }
}
