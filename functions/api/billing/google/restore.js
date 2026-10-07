import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { CALL_METHODS, callSession } from '../../call/_shared.js';
import { recordReferralCommission } from '../_commissions.js';
import { assertGooglePlayBillingReady } from '../_readiness.js';
import { googlePlayOrderPaidAmountKrw, restoreGoogleSubscriptions } from '../_shared.js';
import { callTagReferralForOwner } from '../../referrals/_calltag-store.js';
import { filterGooglePurchasesForOwner } from './_ownership.js';

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
    const purchases = await filterGooglePurchasesForOwner(
      env,
      db,
      session.ownerId,
      session.profile?.email || session.user?.email || '',
      input.purchases,
    );
    const entitlement = await restoreGoogleSubscriptions(
      env,
      db,
      session.ownerId,
      purchases,
    );

    const commissions = [];
    const referral = await callTagReferralForOwner(db, session.ownerId);
    if (referral?.id) for (const purchase of purchases) {
      for (const productCode of Array.isArray(purchase?.products) ? purchase.products.slice(0, 3) : []) {
        // restoreGoogleSubscriptions() verifies the purchase token against Google first and updates
        // billing_subscriptions with Google's latestOrderId. Use that server-verified order ID so
        // each renewal can create one idempotent commission instead of reusing the original client ID.
        const subscription = await db.prepare(`
          SELECT id, order_id, external_subscription_id
          FROM billing_subscriptions
          WHERE owner_id = ?
            AND channel = 'google_play'
            AND product_code = ?
            AND verification_state = 'verified'
          ORDER BY updated_at DESC, id DESC
          LIMIT 1
        `).bind(session.ownerId, productCode).first();
        const paymentReference = String(
          subscription?.order_id
            || subscription?.external_subscription_id
            || purchase?.orderId
            || '',
        ).trim();
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
          commissions.push(await recordReferralCommission(db, {
            referredOwnerId: session.ownerId,
            productCode,
            paymentReference,
            subscriptionId: subscription?.id,
            baseAmountKrw: exactAmount.amountKrw,
            requireExactAmount: true,
            channel: 'google_play',
            status: 'confirmed',
          }));
        } else {
          commissions.push({
            created: false,
            reason: exactAmount.reason || 'PLAY_ORDER_AMOUNT_UNAVAILABLE',
            paymentReference,
          });
        }
      }
    }

    if (referral?.id && !commissions.length && entitlement?.subscription) {
      const productCode = String(entitlement.productCode || '').trim();
      const paymentReference = String(
        entitlement.subscription.orderId || entitlement.subscription.externalSubscriptionId || '',
      ).trim();
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
        commissions.push(await recordReferralCommission(db, {
          referredOwnerId: session.ownerId,
          productCode,
          paymentReference,
          subscriptionId: entitlement.subscription.id,
          baseAmountKrw: exactAmount.amountKrw,
          requireExactAmount: true,
          channel: 'google_play',
          status: 'confirmed',
        }));
      } else {
        commissions.push({
          created: false,
          reason: exactAmount.reason || 'PLAY_ORDER_AMOUNT_UNAVAILABLE',
          paymentReference,
        });
      }
    }

    entitlement.billingAvailability = {
      googlePlay: assertGooglePlayBillingReady(env),
    };
    return jsonResponse(request, env, 200, { ok: true, entitlement, commissions }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
