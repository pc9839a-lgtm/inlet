import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../../_shared.js';
import { notifyUniversalLeadAvailable } from '../../../call/push/_shared.js';
import { receiveGenericWebhook, recordLeadAudit, sha256 } from '../_shared.js';

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
      let pushOwnerId = '';
      try {
        const endpointHash = await sha256(endpointKey);
        const connection = await db.prepare(`
          SELECT owner_id
          FROM calltag_webhook_connections
          WHERE endpoint_hash = ? AND status = 'active'
          LIMIT 1
        `).bind(endpointHash).first();
        pushOwnerId = String(connection?.owner_id || '');
        if (pushOwnerId) {
          await notifyUniversalLeadAvailable(env, db, pushOwnerId, {
            eventId: result.eventId,
          });
        }
      } catch (pushError) {
        const pushCode = String(pushError?.code || 'CALLTAG_PUSH_FAILED').slice(0, 80);
        console.error('CallTag webhook lead push failed', {
          message: String(pushError?.message || pushError || '').slice(0, 180),
        });
        if (pushOwnerId) {
          await recordLeadAudit(db, {
            ownerId: pushOwnerId,
            eventId: result.eventId,
            action: 'webhook.push',
            result: pushCode,
            sourceType: 'custom_webhook',
            statusCode: 503,
          });
        }
      }
    }

    return jsonResponse(request, env, 202, result, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
