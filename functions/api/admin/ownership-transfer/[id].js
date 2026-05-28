import { assertD1, authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson } from '../../_shared.js';
import { OWNERSHIP_METHODS, updateD1OwnershipTransferRequest } from '../../projects/_ownership.js';

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, OWNERSHIP_METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, OWNERSHIP_METHODS);
  try {
    const db = assertD1(env);
    const body = await readJson(request);
    const project = projectFromRequest(new URL(request.url), body, request);
    const { identity } = await authorizeProject(request, env, project, { write: true, tab: 'settings', masterOnly: true });
    const updated = await updateD1OwnershipTransferRequest(db, project, decodeURIComponent(params.id || ''), body, identity || {});
    return jsonResponse(request, env, 200, { ok: true, request: updated }, OWNERSHIP_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, OWNERSHIP_METHODS);
  }
}
