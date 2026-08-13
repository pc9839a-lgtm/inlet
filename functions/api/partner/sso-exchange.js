import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import {
  PARTNER_SECURITY_METHODS,
  exchangePartnerSession,
  partnerAuthCookie,
} from './_security.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, PARTNER_SECURITY_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, PARTNER_SECURITY_METHODS);
  try {
    assertD1(env);
    const input = await readJson(request);
    const auth = await exchangePartnerSession(request, env, {
      ...input,
      session: input.session || input.ticket || '',
    });
    return jsonResponse(request, env, 200, {
      ok: true,
      user: auth.user,
      requiresTotp: true,
    }, PARTNER_SECURITY_METHODS, {
      headers: { 'Set-Cookie': partnerAuthCookie(auth.session, request) },
    });
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_SECURITY_METHODS);
  }
}
