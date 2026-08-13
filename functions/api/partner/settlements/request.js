import { handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { requireFreshSensitiveStepup } from '../_fresh.js';
import { notifyPayoutRequestAdmin } from '../_payout-notification.js';
import {
  PARTNER_PORTAL_METHODS,
  createPayoutRequest,
  normalizeService,
  partnerPortalContext,
} from '../_portal.js';

export async function onRequest(event) {
  const { request, env } = event;
  if (request.method === 'OPTIONS') return optionsResponse(request, env, PARTNER_PORTAL_METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, PARTNER_PORTAL_METHODS);
  }
  try {
    const context = await partnerPortalContext(request, env);
    await requireFreshSensitiveStepup(request, env);
    const input = await readJson(request);
    const service = normalizeService(input.service || 'ALL');
    const payoutRequest = await createPayoutRequest(context.db, context.ownerId, service);
    const notification = notifyPayoutRequestAdmin(env, {
      ownerId: context.ownerId,
      requestId: payoutRequest.requestId,
      month: payoutRequest.month,
      service: payoutRequest.service,
      amountKrw: payoutRequest.amount,
      requestedAt: payoutRequest.requestedAt,
    }).catch((error) => {
      console.error('partner payout admin notification failed', {
        requestId: payoutRequest.requestId,
        name: String(error?.name || ''),
        message: String(error?.message || '').slice(0, 180),
      });
      return { ok: false };
    });
    if (typeof event.waitUntil === 'function') event.waitUntil(notification);
    else await notification;
    return jsonResponse(request, env, 201, { ok: true, request: payoutRequest }, PARTNER_PORTAL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_PORTAL_METHODS);
  }
}
