import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import {
  recordWebhookReceipt,
  verifyWebBillingWebhook,
  webBillingError,
} from '../_webBilling.js';

const METHODS = 'POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    const rawBody = await request.text();
    if (!rawBody || rawBody.length > 256 * 1024) {
      throw webBillingError('Webhook 본문 크기가 올바르지 않습니다.', 400, 'WEBHOOK_BODY_INVALID');
    }

    const verified = await verifyWebBillingWebhook(request, env, rawBody);
    let payload = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw webBillingError('Webhook 데이터 형식이 올바르지 않습니다.', 400, 'WEBHOOK_JSON_INVALID');
    }

    const eventType = String(payload?.type || payload?.eventType || '').trim().slice(0, 120);
    const receipt = await recordWebhookReceipt(db, {
      provider: verified.provider,
      eventId: verified.eventId,
      eventType,
      payloadSha256: verified.payloadSha256,
    });

    return jsonResponse(request, env, 200, {
      ok: true,
      accepted: true,
      duplicate: receipt.duplicate,
      processed: false,
      message: 'Webhook 서명과 중복 수신 여부를 확인했습니다. 제공자별 상태 매핑은 활성화 전 단계입니다.',
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
