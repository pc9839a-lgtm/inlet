import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import { CALL_METHODS, callSession } from '../../call/_shared.js';
import { listPaymentEvents } from '../_paymentHistory.js';
import { listWebOrders } from '../_webBilling.js';

const METHODS = 'GET, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, METHODS);
  }

  try {
    const db = assertD1(env);
    const session = await callSession(request, env);
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(50, Math.trunc(Number(url.searchParams.get('limit') || 20))));
    const [orders, payments] = await Promise.all([
      listWebOrders(db, session.ownerId, limit),
      listPaymentEvents(db, session.ownerId, limit),
    ]);

    return jsonResponse(request, env, 200, {
      ok: true,
      orders,
      payments,
      serverNow: new Date().toISOString(),
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
