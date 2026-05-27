import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../../_shared.js';
import { acceptD1ManagerInvite, INVITE_METHODS } from '../../_invites.js';

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, INVITE_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, INVITE_METHODS);
  try {
    assertD1(env);
    const body = await readJson(request);
    const result = await acceptD1ManagerInvite(request, env, decodeURIComponent(params.token || ''), body);
    return jsonResponse(request, env, 200, { ok: true, ...result }, INVITE_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, INVITE_METHODS);
  }
}
