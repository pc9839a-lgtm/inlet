import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { AUTH_METHODS, authUserPublic, createSessionToken, getSessionAccount } from './_auth.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST' && request.method !== 'GET') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    assertD1(env);
    const input = request.method === 'POST' ? await readJson(request) : {};
    const { payload, user } = await getSessionAccount(request, env, input);
    const publicUser = authUserPublic(user);
    const session = await createSessionToken({
      ownerId: publicUser.ownerId,
      projectId: String(input.projectId || payload.projectId || ''),
      role: payload.role || input.role || 'master',
      email: publicUser.email,
    }, env);
    return jsonResponse(request, env, 200, { ok: true, user: publicUser, session, expiresInSeconds: 60 * 60 * 24 * 30 }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}
