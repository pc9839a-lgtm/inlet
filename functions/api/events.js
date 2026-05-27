import { insertD1Event, listD1Events } from '../../server/storage/d1Adapter.mjs';
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
      const event = body.event && typeof body.event === 'object' ? body.event : body;
      const saved = await insertD1Event(db, {
        ...event,
        createdAt: event.createdAt || new Date().toISOString(),
      }, {
        projectId: project.projectId,
        pageId: body.page?.id || event.pageId || '',
        pageSlug: body.page?.slug || project.slug || event.pageSlug || '',
      });
      return jsonResponse(request, env, 200, { ok: true, event: saved }, METHODS);
    }

    if (request.method === 'GET') {
      const project = projectFromRequest(url, {}, request);
      await authorizeProject(request, env, project);
      const result = await listD1Events(db, {
        projectId: project.projectId,
        month: monthFromRequest(url),
        eventType: url.searchParams.get('eventType') || url.searchParams.get('type') || '',
        cursor: Number(url.searchParams.get('cursor') || 0),
        limit: Number(url.searchParams.get('limit') || 100),
      });
      return jsonResponse(request, env, 200, {
        ok: true,
        events: result.records,
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
