import { jsonResponse, optionsResponse } from '../_shared.js';
import { AUTH_METHODS } from './_auth.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  return jsonResponse(request, env, 200, { ok: true, loggedOut: true, mode: 'stateless-session' }, AUTH_METHODS);
}
