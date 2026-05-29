import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { AUTH_METHODS, createSessionToken, registerAccount } from './_auth.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
    const input = await readJson(request);
    const user = await registerAccount(input.user && typeof input.user === 'object' ? input.user : input, env);
    const session = await createSessionToken({
      ownerId: user.ownerId,
      projectId: String(input.projectId || input.user?.projectId || ''),
      role: 'master',
      email: user.email,
    }, env);
    return jsonResponse(request, env, 200, { ok: true, user, session }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
