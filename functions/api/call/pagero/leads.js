import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import { CALL_METHODS, callSession } from '../_shared.js';
import { listPageroLeads } from './_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALL_METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, CALL_METHODS);
  }

  try {
    const db = assertD1(env);
    const session = await callSession(request, env, {});
    const url = new URL(request.url);
    const result = await listPageroLeads(db, session.ownerId, {
      after: Number(url.searchParams.get('after') || 0),
      limit: Number(url.searchParams.get('limit') || 50),
    });
    return jsonResponse(request, env, 200, {
      ok: true,
      leads: result.records,
      nextAfter: result.nextAfter,
      hasMore: result.hasMore,
    }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
