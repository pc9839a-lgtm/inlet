import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { AUTH_METHODS } from '../auth/_auth.js';
import { callSession } from './_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (!['GET', 'POST'].includes(request.method)) return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
    const input = request.method === 'POST' ? await readJson(request) : {};
    const result = await callSession(request, env, input);
    return jsonResponse(request, env, 200, { ok: true, ...result }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
