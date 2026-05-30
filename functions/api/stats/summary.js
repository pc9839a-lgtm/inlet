import { aggregateD1Stats } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, handleApiError, jsonResponse, monthFromRequest, optionsResponse, projectFromRequest } from '../_shared.js';

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
    await authorizeProject(request, env, project, { tab: 'stats' });
    const month = monthFromRequest(url);
    const result = await aggregateD1Stats(db, {
      projectId: project.projectId,
      month,
      dateFrom: url.searchParams.get('dateFrom') || '',
      dateTo: url.searchParams.get('dateTo') || '',
      channel: url.searchParams.get('channel') || '',
    });

    return jsonResponse(request, env, 200, {
      ok: true,
      source: 'server',
      adapter: 'd1',
      month,
      ...result,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
