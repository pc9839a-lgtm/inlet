import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { CALL_METHODS, callSession } from '../../call/_shared.js';
import { recordReferralCommission } from '../_commissions.js';
import { assertGooglePlayBillingReady } from '../_readiness.js';
import { verifyGoogleSubscription } from '../_shared.js';
import { assertGooglePurchaseOwnership } from './_ownership.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALL_METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, CALL_METHODS);
  }
  try {
    assertGooglePlayBillingReady(env);
    const db = assertD1(env);
    const input = await readJson(request);
    const session = await callSession(request, env, input);
    await assertGooglePurchaseOwnership(db, session.ownerId, input.purchaseToken);
    const entitlement = await verifyGoogleSubscription(env, db, session.ownerId, input);
    const subscription = entitlement?.subscription || {};
    const commission = await recordReferralCommission(db, {
      referredOwnerId: session.ownerId,
      productCode: entitlement?.productCode || input.productId,
      paymentReference: subscription.orderId || input.orderId || subscription.externalSubscriptionId,
      subscriptionId: subscription.id,
      channel: 'google_play',
      status: 'confirmed',
    });
    entitlement.billingAvailability = {
      googlePlay: assertGooglePlayBillingReady(env),
    };
    return jsonResponse(request, env, 200, { ok: true, entitlement, commission }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
