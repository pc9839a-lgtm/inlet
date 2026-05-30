import { decodeD1Page, getD1PageBySlug, upsertD1Page } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, ensureD1ProjectShell, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson, sessionIdentity } from '../_shared.js';

const METHODS = 'GET, POST, OPTIONS';
const PUBLIC_PAGE_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';

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

async function getPublicPageBySlug(db, slug) {
  const row = await db.prepare(`
    SELECT pages.*
    FROM pages
    LEFT JOIN projects ON projects.id = pages.project_id
    WHERE pages.slug = ?
      AND COALESCE(projects.status, 'active') <> 'archived'
    ORDER BY pages.updated_at DESC, projects.updated_at DESC
    LIMIT 1
  `).bind(slug).first();
  if (!row) return { page: null, project: null };
  const page = decodeD1Page(row);
  return { page, project: { projectId: page.projectId, slug: page.slug } };
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
        const result = project.projectId
          ? { project, page: await getD1PageBySlug(db, { projectId: project.projectId, slug }) }
          : await getPublicPageBySlug(db, slug);
        const { page, project: publicProject } = result;
        if (!page) return jsonResponse(request, env, 404, { ok: false, error: '페이지를 찾을 수 없습니다.', message: '페이지를 찾을 수 없습니다.' }, METHODS);
        return jsonResponse(request, env, 200, { ok: true, page: publicPagePayload(page, publicProject) }, METHODS, {
          cacheControl: PUBLIC_PAGE_CACHE_CONTROL,
        });
      }
      await authorizeProject(request, env, project);
      const page = await getD1PageBySlug(db, { projectId: project.projectId, slug });
      if (!page) return jsonResponse(request, env, 404, { ok: false, error: '페이지를 찾을 수 없습니다.', message: '페이지를 찾을 수 없습니다.' }, METHODS);
      return jsonResponse(request, env, 200, { ok: true, page }, METHODS);
    }

    if (request.method === 'POST') {
      const body = await readJson(request);
      const project = projectFromRequest(url, body, request);
      const writeTab = String(body.tab || body.saveTab || 'edit').trim() || 'edit';
      await authorizeProject(request, env, project, { write: true, tab: writeTab });
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

    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.', message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
