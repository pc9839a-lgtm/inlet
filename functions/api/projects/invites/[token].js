import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import { getD1PublicInvite, INVITE_METHODS } from '../_invites.js';

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, INVITE_METHODS);
  if (request.method !== 'GET') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, INVITE_METHODS);
  try {
    const db = assertD1(env);
    const invite = await getD1PublicInvite(db, decodeURIComponent(params.token || ''));
    return jsonResponse(request, env, 200, { ok: true, invite }, INVITE_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, INVITE_METHODS);
  }
}
