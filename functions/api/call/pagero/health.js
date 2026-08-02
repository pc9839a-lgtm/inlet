import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import { ensurePageroLeadQueueSchema } from './_shared.js';

const METHODS = 'GET, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    await ensurePageroLeadQueueSchema(db);
    return jsonResponse(request, env, 200, {
      ok: true,
      service: 'pagero-calltag-lead-queue',
      database: 'ready'
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
