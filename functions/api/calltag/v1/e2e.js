import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import { callSession } from '../../call/_shared.js';
import { createE2eLead, e2eReadiness, getE2eStatus } from './_e2e.js';
import { readJsonLimited } from './_utils.js';

const METHODS = 'GET, POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    if (request.method === 'GET') {
      const session = await callSession(request, env, {});
      const url = new URL(request.url);
      const runId = String(url.searchParams.get('runId') || '').trim();
      if (!runId) {
        return jsonResponse(request, env, 200, {
          ok: true,
          readiness: e2eReadiness(env),
        }, METHODS);
      }
      const db = assertD1(env);
      const status = await getE2eStatus(db, session.ownerId, runId);
      return jsonResponse(request, env, 200, { ok: true, status }, METHODS);
    }

    const body = await readJsonLimited(request, 32768);
    const session = await callSession(request, env, body || {});
    const db = assertD1(env);
    const test = await createE2eLead(env, db, session.ownerId, body || {});
    return jsonResponse(request, env, 201, { ok: true, test }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
