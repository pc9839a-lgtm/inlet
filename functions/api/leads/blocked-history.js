import { listD1BlockedLeadSubmissions } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, currentMonth, handleApiError, jsonResponse, optionsResponse, projectFromRequest } from '../_shared.js';

const METHODS = 'GET, OPTIONS';

function monthFromBlockedHistoryRequest(url) {
  return String(url.searchParams.get('month') || currentMonth()).slice(0, 7);
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);

  try {
    if (request.method !== 'GET') {
      return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
    }

    const url = new URL(request.url);
    const db = assertD1(env);
    const project = projectFromRequest(url, {}, request);
    await authorizeProject(request, env, project);

    const result = await listD1BlockedLeadSubmissions(db, {
      projectId: project.projectId,
      pageSlug: url.searchParams.get('pageSlug') || url.searchParams.get('slug') || '',
      month: monthFromBlockedHistoryRequest(url),
      dateFrom: url.searchParams.get('dateFrom') || '',
      dateTo: url.searchParams.get('dateTo') || '',
      cursor: Number(url.searchParams.get('cursor') || 0),
      limit: Number(url.searchParams.get('limit') || 50),
    });

    return jsonResponse(request, env, 200, {
      ok: true,
      records: result.records,
      total: result.total,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      meta: { source: 'd1', month: monthFromBlockedHistoryRequest(url), ...result.meta },
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
