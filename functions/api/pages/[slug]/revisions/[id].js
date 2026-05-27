import { getD1PageRevision } from '../../../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest } from '../../../_shared.js';

const METHODS = 'GET, OPTIONS';

function safeSlug(value = '') {
  return String(value || 'my-page').replace(/[^a-zA-Z0-9-_]/g, '') || 'my-page';
}

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);

  try {
    if (request.method !== 'GET') {
      return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
    }

    const url = new URL(request.url);
    const db = assertD1(env);
    const project = projectFromRequest(url, {}, request);
    await authorizeProject(request, env, project);
    const revision = await getD1PageRevision(db, {
      projectId: project.projectId,
      slug: safeSlug(params?.slug),
      id: decodeURIComponent(String(params?.id || '')),
    });
    if (!revision) return jsonResponse(request, env, 404, { ok: false, error: 'Revision not found' }, METHODS);
    return jsonResponse(request, env, 200, { ok: true, revision, page: revision.page }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
