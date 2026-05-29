import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { AUTH_METHODS, issueEmailVerificationToken } from './_auth.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
    const input = await readJson(request);
    const verification = await issueEmailVerificationToken(input, env);
    return jsonResponse(request, env, 200, { ok: true, verification }, AUTH_METHODS);
  } catch (error) {
    if (request.headers.get('X-Inlet-Debug') === 'auth-email' && error?.details?.provider === 'ses') {
      return jsonResponse(request, env, Number(error.status || 500), {
        ok: false,
        error: String(error?.message || error),
        debug: error.details,
      }, AUTH_METHODS);
    }
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
