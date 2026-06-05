import { assertD1, authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson } from '../../../_shared.js';
import { deleteGoogleSheetsIntegration } from './_oauth.js';

const METHODS = 'POST, OPTIONS';

export async function onRequestOptions({ request, env }) {
  return optionsResponse(request, env, METHODS);
}

export async function onRequestPost({ request, env }) {
  try {
    assertD1(env);
    const body = await readJson(request);
    const project = projectFromRequest(new URL(request.url), body, request);
    if (!project.projectId) {
      const error = new Error('projectId is required');
      error.status = 400;
      throw error;
    }
    await authorizeProject(request, env, project, { write: true, tab: 'inbox' });
    await deleteGoogleSheetsIntegration(env.DB, project.projectId);
    return jsonResponse(request, env, 200, {
      ok: true,
      provider: 'google_sheets',
      mode: 'oauth',
      status: 'disconnected',
      connected: false,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
