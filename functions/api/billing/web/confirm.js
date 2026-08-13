import {
  apiTokenAuthorized,
  assertD1,
  handleApiError,
  jsonResponse,
  optionsResponse,
  readJson,
} from '../../_shared.js';
import { productPriceKrw, recordReferralCommission } from '../_commissions.js';
import { ensureBillingSchema, resolveEntitlement } from '../_shared.js';
import { recordPaymentEvent } from '../_paymentHistory.js';

const METHODS = 'POST, OPTIONS';
const WEB_PRODUCTS = new Set(['pagero_monthly', 'pagero_pro_monthly', 'pagero_domain_monthly', 'all_monthly']);
const CALLTAG_PRODUCTS = new Set(['all_monthly', 'call_monthly', 'message_monthly']);

function text(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function billingError(message, status = 400, code = 'WEB_BILLING_CONFIRM_FAILED') {
  const error = new Error(message);
  error.status = status;
  error.details = { code };
  return error;
}

async function sha256(value = '') {
  const data = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    if (!apiTokenAuthorized(request, env)) {
      throw billingError('결제 제공자 인증이 필요합니다.', 401, 'WEB_BILLING_PROVIDER_REQUIRED');
    }

    const db = assertD1(env);
    await ensureBillingSchema(db);
    const input = await readJson(request);
    const ownerId = text(input.ownerId, 120);
    const productCode = text(input.productCode, 120);
    const paymentReference = text(input.paymentReference || input.orderId, 240);
    const externalSubscriptionId = text(input.externalSubscriptionId || paymentReference, 240);
    const status = ['active', 'grace', 'cancelled'].includes(String(input.status || '').toLowerCase())
      ? String(input.status).toLowerCase()
      : 'active';
    const startedAt = text(input.startedAt || new Date().toISOString(), 40);
    const nextBillingAt = text(input.nextBillingAt, 40);
    const expiresAt = text(input.expiresAt, 40);
    const amountKrw = Math.round(Number(input.amountKrw || productPriceKrw(productCode)));

    if (!ownerId) throw billingError('결제 계정 정보가 없습니다.', 400, 'WEB_BILLING_OWNER_REQUIRED');
    if (!WEB_PRODUCTS.has(productCode)) throw billingError('페이지로 웹에서는 콜태그 통합권만 결제할 수 있습니다.', 400, 'WEB_PRODUCT_INVALID');
    if (!paymentReference) throw billingError('결제 고유번호가 없습니다.', 400, 'WEB_PAYMENT_REFERENCE_REQUIRED');
    if (!Number.isFinite(amountKrw) || amountKrw <= 0) throw billingError('결제 금액이 올바르지 않습니다.', 400, 'WEB_PAYMENT_AMOUNT_INVALID');

    if (CALLTAG_PRODUCTS.has(productCode)) {
      const playConflict = await db.prepare(`
        SELECT id FROM billing_subscriptions
        WHERE owner_id = ?
          AND channel = 'google_play'
          AND product_code IN ('all_monthly', 'call_monthly', 'message_monthly')
          AND status IN ('active', 'grace', 'cancelled')
          AND (expires_at = '' OR julianday(expires_at) > julianday('now'))
        LIMIT 1
      `).bind(ownerId).first();
      if (playConflict?.id) {
        throw billingError('Google Play 콜태그 구독이 있어 웹 결제를 확정할 수 없습니다.', 409, 'GOOGLE_PLAY_SUBSCRIPTION_ACTIVE');
      }
    }

    if (productCode === 'pagero_domain_monthly') {
      const included = await db.prepare(`
        SELECT id FROM billing_subscriptions
        WHERE owner_id = ?
          AND product_code = 'pagero_pro_monthly'
          AND status IN ('active', 'grace', 'cancelled')
          AND (expires_at = '' OR julianday(expires_at) > julianday('now'))
        LIMIT 1
      `).bind(ownerId).first();
      if (included?.id) {
        throw billingError('페이지로 프로 요금제에 HTTPS 관리가 이미 포함되어 있습니다.', 409, 'DOMAIN_INCLUDED_IN_PRO');
      }
    }

    const tokenHash = await sha256(`web:${paymentReference}`);
    await db.prepare(`
      INSERT INTO billing_subscriptions (
        owner_id, product_code, channel, status, external_subscription_id,
        purchase_token_hash, order_id, started_at, next_billing_at, expires_at,
        auto_renewing, verification_state, last_verified_at, created_at, updated_at
      ) VALUES (?, ?, 'web', ?, ?, ?, ?, ?, ?, ?, ?, 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(channel, purchase_token_hash) DO UPDATE SET
        owner_id = excluded.owner_id,
        product_code = excluded.product_code,
        status = excluded.status,
        external_subscription_id = excluded.external_subscription_id,
        order_id = excluded.order_id,
        started_at = excluded.started_at,
        next_billing_at = excluded.next_billing_at,
        expires_at = excluded.expires_at,
        auto_renewing = excluded.auto_renewing,
        verification_state = 'verified',
        last_verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      ownerId,
      productCode,
      status,
      externalSubscriptionId,
      tokenHash,
      paymentReference,
      startedAt,
      nextBillingAt,
      expiresAt,
      input.autoRenewing === false ? 0 : 1,
    ).run();

    const subscription = await db.prepare(`
      SELECT id FROM billing_subscriptions
      WHERE channel = 'web' AND purchase_token_hash = ?
      LIMIT 1
    `).bind(tokenHash).first();

    try {
      await recordPaymentEvent(db, {
        ownerId,
        subscriptionId: subscription?.id,
        productCode,
        channel: 'web',
        eventType: 'charge',
        paymentReference,
        amountKrw,
        amountSource: 'provider_confirmed',
        paymentStatus: 'paid',
        paidAt: text(input.paidAt || startedAt, 40),
      });
    } catch (error) {
      console.warn('billing-payment-history-web', String(error?.message || 'record_failed').slice(0, 120));
    }

    const commission = await recordReferralCommission(db, {
      referredOwnerId: ownerId,
      productCode,
      paymentReference,
      subscriptionId: subscription?.id,
      baseAmountKrw: amountKrw,
      channel: 'web',
      status: 'confirmed',
    });

    return jsonResponse(request, env, 200, {
      ok: true,
      entitlement: await resolveEntitlement(db, ownerId),
      commission,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
