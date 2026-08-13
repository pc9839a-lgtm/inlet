import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import {
  PARTNER_SECURITY_METHODS,
  partnerStepupCookie,
  verifyPartnerTotp,
} from '../_security.js';
import { createFreshSensitiveSession, partnerFreshCookie } from '../_fresh.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, PARTNER_SECURITY_METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, PARTNER_SECURITY_METHODS);
  }
  try {
    assertD1(env);
    const input = await readJson(request);
    const result = await verifyPartnerTotp(request, env, input);
    const fresh = await createFreshSensitiveSession(env.DB, result.auth.ownerId);
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    headers.append('Set-Cookie', partnerStepupCookie(result.stepup, request));
    headers.append('Set-Cookie', partnerFreshCookie(fresh, request));
    return new Response(JSON.stringify({
      ok: true,
      freshVerified: true,
      expiresAt: fresh.expiresAt,
    }), { status: 200, headers });
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_SECURITY_METHODS);
  }
}
