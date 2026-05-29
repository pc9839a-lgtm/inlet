import { getD1PageBySlug, getD1ProjectBySlug, upsertD1Page } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, ensureD1ProjectShell, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson, sessionIdentity } from '../_shared.js';

const METHODS = 'GET, POST, OPTIONS';

function safeSlug(value = '') {
  return String(value || 'my-page').replace(/[^a-zA-Z0-9-_]/g, '') || 'my-page';
}

function publicPagePayload(page = {}, project = {}) {
  return {
    ...page,
    projectId: page.projectId || project.projectId || project.id || '',
    slug: page.slug || project.slug || '',
    ownership: undefined,
    ai: undefined,
    integrations: {
      conversion: page.integrations?.conversion || {},
    },
  };
}

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);

  try {
    const url = new URL(request.url);
    const slug = safeSlug(params?.slug);
    const db = assertD1(env);

    if (request.method === 'GET') {
      const project = projectFromRequest(url, {}, request);
      if (url.searchParams.get('public') === '1') {
        const publicProject = project.projectId ? project : await getD1ProjectBySlug(db, slug);
        if (!publicProject?.projectId || publicProject.status === 'archived') {
          return jsonResponse(request, env, 404, { ok: false, error: 'Page not found' }, METHODS);
        }
        const page = await getD1PageBySlug(db, { projectId: publicProject.projectId, slug });
        if (!page) return jsonResponse(request, env, 404, { ok: false, error: 'Page not found' }, METHODS);
        return jsonResponse(request, env, 200, { ok: true, page: publicPagePayload(page, publicProject) }, METHODS);
      }
      await authorizeProject(request, env, project);
      const page = await getD1PageBySlug(db, { projectId: project.projectId, slug });
      if (!page) return jsonResponse(request, env, 404, { ok: false, error: 'Page not found' }, METHODS);
      return jsonResponse(request, env, 200, { ok: true, page }, METHODS);
    }

    if (request.method === 'POST') {
      const body = await readJson(request);
      const project = projectFromRequest(url, body, request);
      await authorizeProject(request, env, project, { write: true, tab: 'edit' });
      await ensureD1ProjectShell(db, project);
      const identity = await sessionIdentity(request, env);
      const incoming = body.page && typeof body.page === 'object' ? body.page : body;
      const saved = await upsertD1Page(db, { ...incoming, slug }, {
        projectId: project.projectId,
        slug,
        createdByAccountId: identity?.ownerId || project.ownerId || null,
        reason: body.reason || body.revisionReason || '',
      });
      return jsonResponse(request, env, 200, { ok: true, page: saved }, METHODS);
    }

    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
