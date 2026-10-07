import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { CALL_METHODS, callSession } from '../../call/_shared.js';
import { reconcileCallTagReferralCommission } from '../_commissions.js';
import { assertGooglePlayBillingReady } from '../_readiness.js';
import {
  googlePlayOrder,
  googlePlayOrderIsPayable,
  googlePlayOrderIsRefundPending,
  googlePlayOrderIsVoided,
  googlePlayOrderNetPaidKrw,
  restoreGoogleSubscriptions,
} from '../_shared.js';
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
    for (const purchase of purchases) {
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
        if (!paymentReference) {
          commissions.push({ created: false, reason: 'PLAY_ORDER_REFERENCE_MISSING', productCode });
          continue;
        }
        try {
          const order = await googlePlayOrder(env, 'kr.pagero.calltag', paymentReference);
          const netPaidKrw = googlePlayOrderNetPaidKrw(order);
          const eventKey = String(order?.lastEventTime || order?.state || 'restore');
          if (googlePlayOrderIsVoided(order)) {
            commissions.push(await reconcileCallTagReferralCommission(db, {
              referredOwnerId: session.ownerId,
              productCode,
              paymentReference,
              subscriptionId: subscription?.id,
              baseAmountKrw: 0,
              channel: 'google_play',
              status: 'cancelled',
              eventKey,
            }));
          } else if (googlePlayOrderIsRefundPending(order)) {
            commissions.push(await reconcileCallTagReferralCommission(db, {
              referredOwnerId: session.ownerId,
              productCode,
              paymentReference,
              subscriptionId: subscription?.id,
              baseAmountKrw: netPaidKrw,
              channel: 'google_play',
              status: 'estimated',
              eventKey,
            }));
          } else if (googlePlayOrderIsPayable(order)) {
            commissions.push(netPaidKrw > 0
              ? await reconcileCallTagReferralCommission(db, {
                  referredOwnerId: session.ownerId,
                  productCode,
                  paymentReference,
                  subscriptionId: subscription?.id,
                  baseAmountKrw: netPaidKrw,
                  channel: 'google_play',
                  status: 'confirmed',
                  eventKey,
                })
              : { reconciled: false, reason: 'PLAY_ORDER_KRW_AMOUNT_UNAVAILABLE', productCode });
          } else {
            commissions.push({ reconciled: false, reason: 'PLAY_ORDER_NOT_PROCESSED', productCode });
          }
        } catch (orderError) {
          console.warn(
            'calltag-referral-order-restore',
            String(orderError?.details?.code || orderError?.message || 'PLAY_ORDER_FAILED').slice(0, 120),
          );
          commissions.push({ created: false, reason: 'PLAY_ORDER_LOOKUP_FAILED', productCode });
        }
      }
    }

    // Do not estimate referral cash from catalog prices. A commission is created only
    // after the Google Orders API confirms the processed order and actual KRW amount.

    entitlement.billingAvailability = {
      googlePlay: assertGooglePlayBillingReady(env),
    };
    return jsonResponse(request, env, 200, { ok: true, entitlement, commissions }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
