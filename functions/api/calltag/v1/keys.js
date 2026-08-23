import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import { callSession } from '../../call/_shared.js';
import {
  createLeadApiKey,
  listLeadApiKeys,
  readJsonLimited,
  revokeLeadApiKey,
  rotateLeadApiKey,
} from './_shared.js';

const METHODS = 'GET, POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    const session = await callSession(request, env, {});
    if (request.method === 'GET') {
      const keys = await listLeadApiKeys(db, session.ownerId);
      return jsonResponse(request, env, 200, { ok: true, keys }, METHODS);
    }

    const body = await readJsonLimited(request, 32768);
    const action = String(body?.action || 'create').trim().toLowerCase();
    if (action === 'create') {
      const key = await createLeadApiKey(db, session.ownerId, body || {});
      return jsonResponse(request, env, 201, { ok: true, key }, METHODS);
    }
    if (action === 'rotate') {
      const key = await rotateLeadApiKey(db, session.ownerId, body?.keyId, body || {});
      return jsonResponse(request, env, 201, { ok: true, key }, METHODS);
    }
    if (action === 'revoke') {
      const result = await revokeLeadApiKey(db, session.ownerId, body?.keyId);
      return jsonResponse(request, env, 200, { ok: true, ...result }, METHODS);
    }
    const error = new Error('지원하지 않는 API Key 작업입니다.');
    error.status = 400;
    error.code = 'CALLTAG_API_KEY_ACTION_INVALID';
    throw error;
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
