import { listD1Leads, upsertD1Lead } from '../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, ensureD1ProjectShell, handleApiError, jsonResponse, monthFromRequest, optionsResponse, projectFromRequest, readJson } from './_shared.js';

const METHODS = 'GET, POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);

  try {
    const url = new URL(request.url);
    const db = assertD1(env);

    if (request.method === 'POST') {
      const body = await readJson(request);
      const project = projectFromRequest(url, body, request);
      await authorizeProject(request, env, project, { publicWrite: true });
      await ensureD1ProjectShell(db, project);
      const lead = body.lead && typeof body.lead === 'object' ? body.lead : body;
      const saved = await upsertD1Lead(db, {
        ...lead,
        createdAt: lead.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, {
        projectId: project.projectId,
        pageId: body.page?.id || lead.pageId || '',
        pageSlug: body.page?.slug || project.slug || lead.pageSlug || '',
      });
      return jsonResponse(request, env, 200, { ok: true, lead: saved }, METHODS);
    }

    if (request.method === 'GET') {
      const project = projectFromRequest(url, {}, request);
      await authorizeProject(request, env, project);
      const result = await listD1Leads(db, {
        projectId: project.projectId,
        month: monthFromRequest(url),
        status: url.searchParams.get('status') || '',
        kind: url.searchParams.get('kind') || '',
        deliveryStatus: url.searchParams.get('deliveryStatus') || '',
        q: url.searchParams.get('q') || '',
        cursor: Number(url.searchParams.get('cursor') || 0),
        limit: Number(url.searchParams.get('limit') || 50),
      });
      return jsonResponse(request, env, 200, {
        ok: true,
        leads: result.records,
        total: result.total,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        meta: { source: 'd1', month: monthFromRequest(url), ...result.meta },
      }, METHODS);
    }

    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
