import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import { callSession } from '../../call/_shared.js';
import { notifyUniversalLeadAvailable } from '../../call/push/_shared.js';
import { listUniversalLeadsForDelivery, parseExcludedSourceTypes } from './_delivery.js';
import {
  authenticateLeadApiKey,
  intakeCanonicalLead,
  readJsonLimited,
  recordLeadAudit,
} from './_shared.js';

const METHODS = 'GET, POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  let db = null;
  let apiKey = null;
  const requestId = request.headers.get('CF-Ray') || crypto.randomUUID();
  try {
    db = assertD1(env);
    if (request.method === 'GET') {
      const session = await callSession(request, env, {});
      const url = new URL(request.url);
      const result = await listUniversalLeadsForDelivery(db, session.ownerId, {
        after: url.searchParams.get('after'),
        limit: url.searchParams.get('limit'),
        excludeSourceTypes: parseExcludedSourceTypes(url),
      });
      return jsonResponse(request, env, 200, { ok: true, ...result }, METHODS);
    }

    apiKey = await authenticateLeadApiKey(request, db);
    const body = await readJsonLimited(request);
    const idempotencyKey = String(request.headers.get('Idempotency-Key') || '').trim();
    const stableExternalId = String(body?.event_id || body?.eventId || body?.external_id || body?.externalId || '').trim();
    if (!idempotencyKey && !stableExternalId) {
      const error = new Error('Idempotency-Key 또는 event_id/external_id 중 하나가 필요합니다.');
      error.status = 400;
      error.code = 'CALLTAG_LEAD_IDEMPOTENCY_REQUIRED';
      throw error;
    }
    const result = await intakeCanonicalLead(db, apiKey.ownerId, body, {
      idempotencyKey,
      connectionId: apiKey.connectionId,
    });
    const status = result.created ? 201 : 200;
    await recordLeadAudit(db, {
      requestId,
      ownerId: apiKey.ownerId,
      apiKeyId: apiKey.id,
      eventId: result.eventId,
      action: 'lead.intake',
      result: result.result,
      sourceType: result.event?.source?.type || '',
      statusCode: status,
    });

    // FCM is only a best-effort pull trigger. Accepted leads stay accepted even when one or all
    // registered devices fail to receive the signal; the delivery gap is recorded for operations.
    if (result.created) {
      try {
        const push = await notifyUniversalLeadAvailable(env, db, apiKey.ownerId, {
          eventId: result.eventId,
          leadId: result.event?.id,
        });
        const attempted = Math.max(0, Number(push?.attempted || 0));
        const sent = Math.max(0, Number(push?.sent || 0));
        if (attempted > sent) {
          await recordLeadAudit(db, {
            requestId,
            ownerId: apiKey.ownerId,
            apiKeyId: apiKey.id,
            eventId: result.eventId,
            action: 'lead.push',
            result: sent > 0 ? 'FCM_PARTIAL_FAILURE' : 'FCM_ALL_DEVICES_FAILED',
            sourceType: result.event?.source?.type || 'direct_api',
            statusCode: 503,
          });
        }
      } catch (pushError) {
        const pushCode = String(pushError?.code || pushError?.details?.code || 'CALLTAG_PUSH_FAILED').slice(0, 80);
        console.error('CallTag universal lead push failed', {
          message: String(pushError?.message || pushError || '').slice(0, 180),
        });
        await recordLeadAudit(db, {
          requestId,
          ownerId: apiKey.ownerId,
          apiKeyId: apiKey.id,
          eventId: result.eventId,
          action: 'lead.push',
          result: pushCode,
          sourceType: result.event?.source?.type || 'direct_api',
          statusCode: 503,
        });
      }
    }

    return jsonResponse(request, env, status, {
      ok: true,
      eventId: result.eventId,
      customerId: result.customerId,
      result: result.result,
    }, METHODS);
  } catch (error) {
    if (db && apiKey?.ownerId) {
      await recordLeadAudit(db, {
        requestId,
        ownerId: apiKey.ownerId,
        apiKeyId: apiKey.id,
        action: 'lead.intake',
        result: error?.code || error?.details?.code || 'REJECTED',
        statusCode: Number(error?.status || 500),
      });
    }
    return handleApiError(request, env, error, METHODS);
  }
}
