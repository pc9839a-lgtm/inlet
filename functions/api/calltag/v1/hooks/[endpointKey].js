import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../../../_shared.js';
import { notifyUniversalLeadAvailable } from '../../../call/push/_shared.js';
import { receiveGenericWebhook, sha256 } from '../../_shared.js';

const METHODS = 'POST, OPTIONS';

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    const endpointKey = String(params?.endpointKey || '').trim();
    const result = await receiveGenericWebhook(request, db, endpointKey);

    // Webhook acceptance is independent from FCM. Resolve owner again from the hashed endpoint so
    // no tenant identity can ever come from the webhook body or query string.
    if (result?.status === 'MAPPED'
        && result?.eventId
        && result?.result !== 'DUPLICATE_IGNORED') {
      try {
        const endpointHash = await sha256(endpointKey);
        const connection = await db.prepare(`
          SELECT owner_id
          FROM calltag_webhook_connections
          WHERE endpoint_hash = ? AND status = 'active'
          LIMIT 1
        `).bind(endpointHash).first();
        if (connection?.owner_id) {
          await notifyUniversalLeadAvailable(env, db, connection.owner_id, {
            eventId: result.eventId,
          });
        }
      } catch (pushError) {
        console.error('CallTag webhook lead push failed', {
          message: String(pushError?.message || pushError || '').slice(0, 180),
        });
      }
    }

    return jsonResponse(request, env, 202, result, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
