import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { CALL_METHODS, callSession } from '../../call/_shared.js';
import { recordReferralCommission } from '../_commissions.js';
import { assertGooglePlayBillingReady } from '../_readiness.js';
import { restoreGoogleSubscriptions } from '../_shared.js';

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
    const entitlement = await restoreGoogleSubscriptions(
      env,
      db,
      session.ownerId,
      input.purchases,
    );

    const commissions = [];
    for (const purchase of Array.isArray(input.purchases) ? input.purchases.slice(0, 10) : []) {
      const paymentReference = String(purchase?.orderId || '').trim();
      for (const productCode of Array.isArray(purchase?.products) ? purchase.products.slice(0, 3) : []) {
        const commission = await recordReferralCommission(db, {
          referredOwnerId: session.ownerId,
          productCode,
          paymentReference,
          channel: 'google_play',
          status: 'confirmed',
        });
        commissions.push(commission);
      }
    }

    if (!commissions.length && entitlement?.subscription) {
      commissions.push(await recordReferralCommission(db, {
        referredOwnerId: session.ownerId,
        productCode: entitlement.productCode,
        paymentReference: entitlement.subscription.orderId || entitlement.subscription.externalSubscriptionId,
        subscriptionId: entitlement.subscription.id,
        channel: 'google_play',
        status: 'confirmed',
      }));
    }

    entitlement.billingAvailability = {
      googlePlay: assertGooglePlayBillingReady(env),
    };
    return jsonResponse(request, env, 200, { ok: true, entitlement, commissions }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
