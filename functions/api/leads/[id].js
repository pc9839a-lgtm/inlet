import { deleteD1Lead, getD1Lead, upsertD1Lead } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson } from '../_shared.js';

const METHODS = 'PATCH, DELETE, OPTIONS';

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);

  try {
    const url = new URL(request.url);
    const id = String(params?.id || url.pathname.split('/').pop() || '').trim();
    if (!id) return jsonResponse(request, env, 400, { ok: false, error: 'Lead id is required.' }, METHODS);

    const db = assertD1(env);

    if (request.method === 'PATCH') {
      const body = await readJson(request);
      const project = projectFromRequest(url, body, request);
      await authorizeProject(request, env, project, { write: true, tab: 'inbox' });
      const current = await getD1Lead(db, { projectId: project.projectId, id });
      if (!current) return jsonResponse(request, env, 404, { ok: false, error: 'Lead not found.' }, METHODS);

      assertLeadVersion(current, body.patch || {}, id);
      const patch = sanitizedLeadPatch(body.patch || {});
      const saved = await upsertD1Lead(db, {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      }, {
        projectId: project.projectId,
        pageId: current.pageId || '',
        pageSlug: current.pageSlug || project.slug || '',
      });
      return jsonResponse(request, env, 200, { ok: true, lead: saved }, METHODS);
    }

    if (request.method === 'DELETE') {
      const body = await readOptionalJson(request);
      const project = projectFromRequest(url, body, request);
      await authorizeProject(request, env, project, { write: true, tab: 'inbox' });
      const current = await getD1Lead(db, { projectId: project.projectId, id });
      if (!current) return jsonResponse(request, env, 404, { ok: false, error: 'Lead not found.' }, METHODS);
      const deleted = await deleteD1Lead(db, { projectId: project.projectId, id });
      return jsonResponse(request, env, 200, { ok: true, ...deleted }, METHODS);
    }

    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}

async function readOptionalJson(request) {
  try {
    return await readJson(request);
  } catch {
    return {};
  }
}

function assertLeadVersion(current = {}, patch = {}, id = '') {
  const expectedUpdatedAt = patch.__expectedUpdatedAt || patch.expectedUpdatedAt || '';
  const currentVersion = current.updatedAt || current.savedAt || current.createdAt || '';
  if (expectedUpdatedAt && currentVersion && String(expectedUpdatedAt) !== String(currentVersion)) {
    const error = new Error('Lead was changed elsewhere. Reload before saving.');
    error.status = 409;
    error.details = {
      code: 'LEAD_REVISION_CONFLICT',
      latest: {
        id: current.id || id,
        updatedAt: current.updatedAt || '',
        savedAt: current.savedAt || '',
        createdAt: current.createdAt || '',
        status: current.status || '',
      },
    };
    throw error;
  }
}

function sanitizedLeadPatch(patch = {}) {
  const safePatch = { ...patch };
  delete safePatch.id;
  delete safePatch.project;
  delete safePatch.__expectedUpdatedAt;
  delete safePatch.expectedUpdatedAt;
  return safePatch;
}
