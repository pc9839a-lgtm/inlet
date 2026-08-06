import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { AUTH_METHODS, confirmEmailVerificationToken } from '../_auth.js';
import { withCompatibleAuthVerificationStorage } from '../_verification-storage-compat.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
    const input = await readJson(request);
    const verification = await confirmEmailVerificationToken(input, withCompatibleAuthVerificationStorage(env));
    return jsonResponse(request, env, 200, { ok: true, verification }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
