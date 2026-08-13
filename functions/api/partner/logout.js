import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../_shared.js';
import {
  PARTNER_SECURITY_METHODS,
  clearPartnerAuthCookie,
  clearPartnerStepupCookie,
  partnerAuthSession,
  revokeSettlementSessions,
} from './_security.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, PARTNER_SECURITY_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, PARTNER_SECURITY_METHODS);
  try {
    assertD1(env);
    const auth = await partnerAuthSession(request, env);
    await revokeSettlementSessions(env.DB, auth.ownerId);
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    headers.append('Set-Cookie', clearPartnerAuthCookie(request));
    headers.append('Set-Cookie', clearPartnerStepupCookie(request));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_SECURITY_METHODS);
  }
}
