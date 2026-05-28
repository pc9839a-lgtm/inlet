import { assertD1, authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson } from '../_shared.js';
import { createD1ManagerInvite, INVITE_METHODS } from './_invites.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, INVITE_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, INVITE_METHODS);
  try {
    const db = assertD1(env);
    const body = await readJson(request);
    const project = projectFromRequest(new URL(request.url), body, request);
    const { identity } = await authorizeProject(request, env, project, { write: true, tab: 'settings', masterOnly: true });
    const invite = await createD1ManagerInvite(db, project, body.manager || {}, identity || {});
    return jsonResponse(request, env, 200, { ok: true, invite }, INVITE_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, INVITE_METHODS);
  }
}
