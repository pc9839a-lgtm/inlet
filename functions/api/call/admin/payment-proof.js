import { googlePlayOrderPaidAmountKrw } from '../../billing/_shared.js';
import { adminErrorResponse, adminJson, adminOptions, ownerIdInput, recordAdminAudit, requireCalltagAdmin } from './_security.js';

// On-demand, read-only reconciliation with the original Google Play order.
// Never infer that a verified subscription has actually charged a customer.
// No purchase tokens, order IDs, credentials or raw provider JSON are returned.
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  try {
    const operator = await requireCalltagAdmin(request, env);
    const ownerId = ownerIdInput(new URL(request.url).searchParams.get('ownerId') || '');
    const evidence = await env.DB.prepare(`
      SELECT product_code, channel, status, order_id, verification_state
      FROM billing_subscriptions
      WHERE owner_id = ? AND product_code IN ('call_monthly','message_monthly','all_monthly')
        AND channel = 'google_play' AND verification_state = 'verified'
      ORDER BY datetime(last_verified_at) DESC, id DESC
      LIMIT 1
    `).bind(ownerId).first();
    if (!evidence) {
      return adminJson(200, { ok: true, ownerId, result: 'no_verified_play_order', confirmed: false });
    }
    const orderId = String(evidence.order_id || '').trim();
    const productCode = String(evidence.product_code || '');
    if (!orderId) {
      return adminJson(200, { ok: true, ownerId, result: 'order_id_missing', confirmed: false, productCode });
    }
    let proof;
    try {
      proof = await googlePlayOrderPaidAmountKrw(env, 'kr.pagero.calltag', orderId, productCode);
    } catch (error) {
      console.warn('calltag-admin-payment-proof-error', String(error?.details?.code || error?.message || 'verification_failed').slice(0, 100));
      return adminJson(200, { ok: true, ownerId, confirmed: false, result: 'provider_unavailable', productCode });
    }
    await recordAdminAudit(env.DB, request, env, operator, 'member.payment.proof.read', ownerId);
    if (proof?.ok === true && Number(proof.amountKrw || 0) > 0) {
      return adminJson(200, {
        ok: true, ownerId, confirmed: true, result: 'play_order_paid', productCode,
        amountKrw: Math.max(0, Math.round(Number(proof.amountKrw || 0))),
        currency: 'KRW', source: 'google_play_orders_api',
        subscriptionStatus: String(evidence.status || '').slice(0, 32),
      });
    }
    return adminJson(200, {
      ok: true, ownerId, confirmed: false, productCode,
      result: [
        'PLAY_ORDER_INPUT_INCOMPLETE','PLAY_ORDER_NETWORK_FAILED','PLAY_ORDER_LOOKUP_FAILED',
        'PLAY_ORDER_NOT_PROCESSED','PLAY_ORDER_PRODUCT_TOTAL_MISSING',
        'PLAY_ORDER_NON_KRW','PLAY_ORDER_AMOUNT_INVALID',
      ].includes(String(proof?.reason || '')) ? String(proof.reason) : 'provider_unavailable',
      providerHttpStatus: [401,403,404].includes(Number(proof?.googleStatus || 0))
        ? Number(proof.googleStatus) : 0,
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
