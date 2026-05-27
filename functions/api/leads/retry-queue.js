import { listD1DeliveryRetryQueue } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest } from '../_shared.js';

const METHODS = 'GET, OPTIONS';

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

    const result = await listD1DeliveryRetryQueue(db, {
      projectId: project.projectId,
      status: url.searchParams.get('status') || '',
      cursor: Number(url.searchParams.get('cursor') || 0),
      limit: Number(url.searchParams.get('limit') || 200),
    });

    return jsonResponse(request, env, 200, {
      ok: true,
      total: result.total,
      retryable: result.retryable,
      deadLetter: result.deadLetter,
      failed: result.failed,
      partial: result.partial,
      count: result.count,
      entries: result.entries,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      queryPlan: {
        adapter: 'd1',
        indexed: true,
        fullScan: false,
        type: 'delivery-retry-queue',
      },
      meta: { source: 'd1', ...result.meta },
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
