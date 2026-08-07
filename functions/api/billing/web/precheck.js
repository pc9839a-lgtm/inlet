import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { CALL_METHODS, callSession } from '../../call/_shared.js';
import { listSubscriptions, resolveEntitlement } from '../_shared.js';

const WEB_PRODUCTS = new Set(['pagero_monthly', 'pagero_pro_monthly', 'all_monthly']);
const PAGERO_PRODUCTS = new Set(['pagero_monthly', 'pagero_pro_monthly']);
const CALLTAG_PRODUCTS = new Set(['all_monthly', 'call_monthly', 'message_monthly']);

function sameServiceProduct(requestedProductCode = '', existingProductCode = '') {
  if (PAGERO_PRODUCTS.has(requestedProductCode)) return PAGERO_PRODUCTS.has(existingProductCode);
  if (CALLTAG_PRODUCTS.has(requestedProductCode)) return CALLTAG_PRODUCTS.has(existingProductCode);
  return false;
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALL_METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, CALL_METHODS);
  }

  try {
    const db = assertD1(env);
    const input = await readJson(request);
    const session = await callSession(request, env, input);
    const productCode = String(input.productCode || '').trim();
    if (!WEB_PRODUCTS.has(productCode)) {
      return jsonResponse(request, env, 400, {
        ok: false,
        error: '지원하지 않는 웹 구독 상품입니다.',
        code: 'WEB_PRODUCT_INVALID',
      }, CALL_METHODS);
    }

    const [entitlement, subscriptions] = await Promise.all([
      resolveEntitlement(db, session.ownerId),
      listSubscriptions(db, session.ownerId),
    ]);
    const active = subscriptions.find((item) =>
      sameServiceProduct(productCode, String(item.productCode || ''))
      && ['active', 'grace', 'cancelled'].includes(String(item.status || ''))
      && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now())
    );

    let allowed = true;
    let reason = '';
    let message = '웹 결제 단계로 진행할 수 있습니다.';
    if (active) {
      allowed = false;
      reason = active.channel === 'google_play'
        ? 'GOOGLE_PLAY_SUBSCRIPTION_ACTIVE'
        : active.channel === 'referral'
          ? 'REFERRAL_CLASSIC_PASS_ACTIVE'
          : 'WEB_SUBSCRIPTION_ACTIVE';
      message = active.channel === 'google_play'
        ? '콜태그를 Google Play에서 이미 이용 중입니다. 웹에서 다시 결제하지 않아도 됩니다.'
        : active.channel === 'referral'
          ? '추천 혜택으로 페이지로 클래식 7일 이용권이 적용 중입니다. 이용 기간 종료 후 결제해주세요.'
          : '해당 서비스에서 이미 이용 중인 구독이 있습니다.';
    }

    return jsonResponse(request, env, 200, {
      ok: true,
      serverNow: new Date().toISOString(),
      checkoutDecision: {
        allowed,
        reason,
        message,
        productCode,
        currentChannel: active?.channel || 'none',
        currentProductCode: active?.productCode || '',
        accountEntitlement: entitlement.status || 'inactive',
      },
    }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
