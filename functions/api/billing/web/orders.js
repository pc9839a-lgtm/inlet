import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { CALL_METHODS, callSession } from '../../call/_shared.js';
import {
  assertWebBillingOrderWriteReady,
  createWebOrder,
  listWebOrders,
  webBillingReadiness,
} from '../_webBilling.js';

const METHODS = 'GET, POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    if (request.method === 'GET') {
      const session = await callSession(request, env);
      const url = new URL(request.url);
      const orders = await listWebOrders(db, session.ownerId, Number(url.searchParams.get('limit') || 20));
      return jsonResponse(request, env, 200, {
        ok: true,
        orders,
        billingReadiness: webBillingReadiness(env),
      }, METHODS);
    }

    const input = await readJson(request);
    const session = await callSession(request, env, input);
    const readiness = assertWebBillingOrderWriteReady(env);
    const order = await createWebOrder(db, {
      ownerId: session.ownerId,
      productCode: input.productCode,
      idempotencyKey: input.idempotencyKey,
      provider: readiness.provider,
    });

    return jsonResponse(request, env, 201, {
      ok: true,
      order,
      billingReadiness: readiness,
      chargingStarted: false,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
