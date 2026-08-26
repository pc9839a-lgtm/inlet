import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../../_shared.js';
import { acceptMetaWebhookRequest, processMetaLeadEvents, verifyMetaWebhookChallenge } from '../_shared.js';

const METHODS = 'GET, POST, OPTIONS';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    if (request.method === 'GET') {
      const challenge = verifyMetaWebhookChallenge(request, env);
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const db = assertD1(env);
    const accepted = await acceptMetaWebhookRequest(request, env);
    const requestId = request.headers.get('CF-Ray') || crypto.randomUUID();
    const work = processMetaLeadEvents(env, db, accepted.events, { requestId })
      .catch((error) => {
        console.error('CallTag Meta webhook processing failed', {
          message: String(error?.message || error || '').slice(0, 180),
        });
      });

    if (typeof context.waitUntil === 'function') context.waitUntil(work);
    else await work;

    return jsonResponse(request, env, 200, {
      ok: true,
      received: true,
      events: accepted.events.length,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
