import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import { callSession } from '../../call/_shared.js';
import {
  createWebhookConnection,
  listWebhookConnections,
  readJsonLimited,
  replayWebhookRawEvent,
  revokeWebhookConnection,
  rotateWebhookEndpoint,
  setWebhookRetention,
  updateWebhookMapping,
} from './_shared.js';

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
      const connections = await listWebhookConnections(db, session.ownerId);
      return jsonResponse(request, env, 200, { ok: true, connections }, METHODS);
    }

    const body = await readJsonLimited(request, 65536);
    const session = await callSession(request, env, body || {});

    if (request.method === 'POST') {
      const result = await createWebhookConnection(db, session.ownerId, body || {});
      return jsonResponse(request, env, 201, {
        ok: true,
        connection: result.connection,
        endpointKey: result.endpointKey,
        endpointPath: result.endpointPath,
        endpointUrl: `${new URL(request.url).origin}${result.endpointPath}`,
        secretShownOnce: true,
      }, METHODS);
    }

    const action = String(body?.action || 'update_mapping').trim().toLowerCase();
    const connectionId = String(body?.connectionId || body?.id || '').trim();
    if (!connectionId) {
      const error = new Error('connectionId가 필요합니다.');
      error.status = 400;
      error.code = 'CALLTAG_WEBHOOK_CONNECTION_ID_REQUIRED';
      throw error;
    }

    if (action === 'update_mapping') {
      const connection = await updateWebhookMapping(db, session.ownerId, connectionId, body?.mapping || {});
      return jsonResponse(request, env, 200, { ok: true, connection }, METHODS);
    }
    if (action === 'rotate_endpoint') {
      const result = await rotateWebhookEndpoint(db, session.ownerId, connectionId);
      return jsonResponse(request, env, 200, {
        ok: true,
        connection: result.connection,
        endpointKey: result.endpointKey,
        endpointPath: result.endpointPath,
        endpointUrl: `${new URL(request.url).origin}${result.endpointPath}`,
        secretShownOnce: true,
      }, METHODS);
    }
    if (action === 'revoke') {
      const connection = await revokeWebhookConnection(db, session.ownerId, connectionId);
      return jsonResponse(request, env, 200, { ok: true, connection }, METHODS);
    }
    if (action === 'set_retention') {
      const connection = await setWebhookRetention(db, session.ownerId, connectionId, body?.rawRetentionDays);
      return jsonResponse(request, env, 200, { ok: true, connection }, METHODS);
    }
    if (action === 'replay_raw') {
      const result = await replayWebhookRawEvent(db, session.ownerId, connectionId, body?.rawEventId);
      return jsonResponse(request, env, 200, result, METHODS);
    }

    const error = new Error('지원하지 않는 Webhook 연결 작업입니다.');
    error.status = 400;
    error.code = 'CALLTAG_WEBHOOK_ACTION_INVALID';
    throw error;
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
