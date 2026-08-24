import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../../_shared.js';
import { callSession } from '../../../call/_shared.js';
import { listMetaConnections, readJsonLimited, revokeMetaConnection, upsertMetaConnection } from '../_shared.js';

const METHODS = 'GET, POST, PATCH, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    if (request.method === 'GET') {
      const session = await callSession(request, env, {});
      return jsonResponse(request, env, 200, {
        ok: true,
        connections: await listMetaConnections(db, session.ownerId),
      }, METHODS);
    }

    const body = await readJsonLimited(request, 65536);
    const session = await callSession(request, env, body || {});
    if (request.method === 'POST') {
      const connection = await upsertMetaConnection(db, session.ownerId, body || {}, env);
      return jsonResponse(request, env, 201, {
        ok: true,
        connection,
        credentialStoredEncrypted: true,
      }, METHODS);
    }

    const action = String(body?.action || 'revoke').trim().toLowerCase();
    if (action !== 'revoke') {
      const error = new Error('지원하지 않는 Meta 연결 작업입니다.');
      error.status = 400;
      error.code = 'CALLTAG_META_ACTION_INVALID';
      throw error;
    }
    const connectionId = String(body?.connectionId || body?.id || '').trim();
    if (!connectionId) {
      const error = new Error('connectionId가 필요합니다.');
      error.status = 400;
      error.code = 'CALLTAG_META_CONNECTION_ID_REQUIRED';
      throw error;
    }
    const connection = await revokeMetaConnection(db, session.ownerId, connectionId);
    return jsonResponse(request, env, 200, { ok: true, connection }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
