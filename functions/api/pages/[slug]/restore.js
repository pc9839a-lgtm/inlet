import { getD1PageRevision, upsertD1Page } from '../../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, ensureD1ProjectShell, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson, sessionIdentity } from '../../_shared.js';

const METHODS = 'POST, OPTIONS';

function safeSlug(value = '') {
  return String(value || 'my-page').replace(/[^a-zA-Z0-9-_]/g, '') || 'my-page';
}

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);

  try {
    if (request.method !== 'POST') {
      return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
    }

    const url = new URL(request.url);
    const body = await readJson(request);
    const db = assertD1(env);
    const project = projectFromRequest(url, body, request);
    await authorizeProject(request, env, project, { write: true });
    await ensureD1ProjectShell(db, project);
    const slug = safeSlug(params?.slug);
    const revision = await getD1PageRevision(db, {
      projectId: project.projectId,
      slug,
      id: body.revisionId || body.id || '',
    });
    if (!revision?.page) return jsonResponse(request, env, 404, { ok: false, error: 'Revision not found' }, METHODS);
    const identity = await sessionIdentity(request, env);
    const restored = await upsertD1Page(db, { ...revision.page, slug }, {
      projectId: project.projectId,
      slug,
      createdByAccountId: identity?.ownerId || project.ownerId || null,
      reason: `restore:${revision.id || body.revisionId || ''}`,
    });
    return jsonResponse(request, env, 200, { ok: true, page: restored }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
