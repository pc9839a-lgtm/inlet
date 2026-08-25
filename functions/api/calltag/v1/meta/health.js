import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../../_shared.js';
import { callSession } from '../../../call/_shared.js';
import { checkMetaConnectionHealth } from '../_meta-health.js';
import { readJsonLimited } from '../_shared.js';

const METHODS = 'POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    const body = await readJsonLimited(request, 16384);
    const session = await callSession(request, env, body || {});
    const health = await checkMetaConnectionHealth(
      db,
      session.ownerId,
      body?.connectionId || body?.id || '',
      env,
    );
    return jsonResponse(request, env, 200, { ok: true, health }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
