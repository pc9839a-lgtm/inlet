import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { CALL_METHODS, callSession } from '../../call/_shared.js';
import { recordReferralCommission } from '../_commissions.js';
import { assertGooglePlayBillingReady } from '../_readiness.js';
import { googlePlayOrderPaidAmountKrw, verifyGoogleSubscription } from '../_shared.js';
import { callTagReferralForOwner } from '../../referrals/_calltag-store.js';
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
    await assertGooglePurchaseOwnership(
      env,
      db,
      session.ownerId,
      session.profile?.email || session.user?.email || '',
      input.purchaseToken,
    );
    const entitlement = await verifyGoogleSubscription(env, db, session.ownerId, input);
    const subscription = entitlement?.subscription || {};
    const productCode = String(entitlement?.productCode || input.productId || '').trim();
    const paymentReference = String(
      subscription.orderId || subscription.externalSubscriptionId || '',
    ).trim();

    let commission = { created: false, reason: 'REFERRAL_NOT_FOUND' };
    const referral = await callTagReferralForOwner(db, session.ownerId);
    if (referral?.id) {
      let exactAmount;
      try {
        exactAmount = await googlePlayOrderPaidAmountKrw(
          env,
          'kr.pagero.calltag',
          paymentReference,
          productCode,
        );
      } catch (error) {
        exactAmount = { ok: false, amountKrw: 0, reason: 'PLAY_ORDER_LOOKUP_FAILED' };
      }

      if (exactAmount.ok) {
        commission = await recordReferralCommission(db, {
          referredOwnerId: session.ownerId,
          productCode,
          paymentReference,
          subscriptionId: subscription.id,
          baseAmountKrw: exactAmount.amountKrw,
          requireExactAmount: true,
          channel: 'google_play',
          status: 'confirmed',
        });
      } else {
        commission = {
          created: false,
          reason: exactAmount.reason || 'PLAY_ORDER_AMOUNT_UNAVAILABLE',
          paymentReference,
        };
      }
    }
    entitlement.billingAvailability = {
      googlePlay: assertGooglePlayBillingReady(env),
    };
    return jsonResponse(request, env, 200, { ok: true, entitlement, commission }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
