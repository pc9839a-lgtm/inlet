import { assertD1 } from '../../_shared.js';
import {
  googlePlayOrder,
  googlePlayOrderIsPayable,
  googlePlayOrderIsRefundPending,
  googlePlayOrderIsVoided,
  googlePlayOrderNetPaidKrw,
  googlePlaySubscription,
  purchaseTokenHash,
  verifyGoogleSubscription,
} from '../_shared.js';
import {
  cancelReferralCommission,
  reconcileCallTagReferralCommission,
} from '../_commissions.js';

const PACKAGE_NAME = 'kr.pagero.calltag';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function text(value, max = 4096) {
  return String(value || '').trim().slice(0, max);
}

function decodePubSubData(value = '') {
  const normalized = text(value, 128 * 1024)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!normalized) return null;
  try {
    const decoded = atob(normalized);
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function secretMatches(request, env) {
  const expected = text(env.GOOGLE_PLAY_RTDN_SECRET, 512);
  if (!expected) return false;
  const url = new URL(request.url);
  const provided = text(
    request.headers.get('X-CallTag-RTDN-Secret')
      || url.searchParams.get('token')
      || '',
    512,
  );
  return provided.length === expected.length && provided === expected;
}

async function subscriptionOwner(db, purchaseToken, purchase = null) {
  const tokenHash = await purchaseTokenHash(purchaseToken);
  let row = await db.prepare(`
    SELECT id, owner_id, product_code, order_id
    FROM billing_subscriptions
    WHERE channel = 'google_play'
      AND purchase_token_hash = ?
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `).bind(tokenHash).first();
  if (row?.owner_id) return row;

  const linkedToken = text(purchase?.linkedPurchaseToken, 4096);
  if (!linkedToken) return null;
  const linkedHash = await purchaseTokenHash(linkedToken);
  row = await db.prepare(`
    SELECT id, owner_id, product_code, order_id
    FROM billing_subscriptions
    WHERE channel = 'google_play'
      AND purchase_token_hash = ?
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `).bind(linkedHash).first();
  return row?.owner_id ? row : null;
}

async function processSubscriptionNotification(db, env, notification) {
  const purchaseToken = text(notification?.purchaseToken, 4096);
  if (!purchaseToken) return { ok: true, ignored: 'PURCHASE_TOKEN_MISSING' };

  const purchase = await googlePlaySubscription(env, PACKAGE_NAME, purchaseToken);
  const lineItems = Array.isArray(purchase?.lineItems) ? purchase.lineItems : [];
  const productCode = text(lineItems[0]?.productId, 120);
  if (!['call_monthly', 'message_monthly', 'all_monthly'].includes(productCode)) {
    return { ok: true, ignored: 'NON_CALLTAG_PRODUCT' };
  }

  const owner = await subscriptionOwner(db, purchaseToken, purchase);
  if (!owner?.owner_id) {
    // A brand-new purchase is normally verified by the app first. Returning 200 prevents
    // endless Pub/Sub retries; once the app verifies, later renewal RTDNs can be resolved.
    console.warn('calltag-rtdn-owner-unresolved', {
      productCode,
      notificationType: Number(notification?.notificationType || 0),
    });
    return { ok: true, ignored: 'OWNER_NOT_RESOLVED' };
  }

  await verifyGoogleSubscription(env, db, owner.owner_id, {
    packageName: PACKAGE_NAME,
    productId: productCode,
    purchaseToken,
    orderId: owner.order_id || '',
    allowInactive: true,
  });

  const subscription = await db.prepare(`
    SELECT id, order_id, external_subscription_id
    FROM billing_subscriptions
    WHERE owner_id = ?
      AND channel = 'google_play'
      AND product_code = ?
      AND verification_state = 'verified'
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `).bind(owner.owner_id, productCode).first();

  const orderId = text(
    subscription?.order_id
      || lineItems[0]?.latestSuccessfulOrderId
      || purchase?.latestOrderId
      || '',
    240,
  );
  if (!orderId) return { ok: true, ignored: 'ORDER_ID_MISSING' };

  const order = await googlePlayOrder(env, PACKAGE_NAME, orderId);
  const netPaidKrw = googlePlayOrderNetPaidKrw(order);
  const eventKey = String(order?.lastEventTime || order?.state || notification?.notificationType || 'rtdn');

  let commission;
  if (googlePlayOrderIsVoided(order)) {
    commission = await reconcileCallTagReferralCommission(db, {
      referredOwnerId: owner.owner_id,
      productCode,
      paymentReference: orderId,
      subscriptionId: subscription?.id,
      baseAmountKrw: 0,
      channel: 'google_play',
      status: 'cancelled',
      eventKey,
    });
  } else if (googlePlayOrderIsRefundPending(order)) {
    commission = await reconcileCallTagReferralCommission(db, {
      referredOwnerId: owner.owner_id,
      productCode,
      paymentReference: orderId,
      subscriptionId: subscription?.id,
      baseAmountKrw: netPaidKrw,
      channel: 'google_play',
      status: 'estimated',
      eventKey,
    });
  } else if (googlePlayOrderIsPayable(order)) {
    if (netPaidKrw <= 0) {
      return { ok: true, orderId, productCode, ignored: 'KRW_AMOUNT_UNAVAILABLE' };
    }
    commission = await reconcileCallTagReferralCommission(db, {
      referredOwnerId: owner.owner_id,
      productCode,
      paymentReference: orderId,
      subscriptionId: subscription?.id,
      baseAmountKrw: netPaidKrw,
      channel: 'google_play',
      status: 'confirmed',
      eventKey,
    });
  } else {
    return { ok: true, orderId, productCode, ignored: 'ORDER_NOT_PROCESSED' };
  }
  return { ok: true, orderId, productCode, netPaidKrw, commission };
}

async function processVoidedPurchase(db, notification, eventKey = '') {
  const orderId = text(notification?.orderId, 240);
  if (!orderId) return { ok: true, ignored: 'VOIDED_ORDER_ID_MISSING' };
  const cancelled = await cancelReferralCommission(db, {
    paymentReference: orderId,
    channel: 'google_play',
    eventKey: eventKey || `voided_${notification?.voidedTimeMillis || notification?.voidedReason || 'event'}`,
  });
  return {
    ok: true,
    orderId,
    voidedReason: Number(notification?.voidedReason || 0),
    voidedSource: Number(notification?.voidedSource || 0),
    cancelled,
  };
}

export async function onRequestPost({ request, env }) {
  if (!secretMatches(request, env)) {
    return json(text(env.GOOGLE_PLAY_RTDN_SECRET, 512) ? 401 : 503, {
      ok: false,
      code: text(env.GOOGLE_PLAY_RTDN_SECRET, 512)
        ? 'RTDN_AUTH_INVALID'
        : 'RTDN_SECRET_NOT_CONFIGURED',
    });
  }

  let envelope;
  try {
    envelope = await request.json();
  } catch {
    return json(400, { ok: false, code: 'RTDN_JSON_INVALID' });
  }

  const payload = decodePubSubData(envelope?.message?.data);
  if (!payload || text(payload.packageName, 200) !== PACKAGE_NAME) {
    return json(400, { ok: false, code: 'RTDN_PAYLOAD_INVALID' });
  }

  const db = assertD1(env);
  try {
    let result;
    if (payload.subscriptionNotification) {
      result = await processSubscriptionNotification(
        db,
        env,
        payload.subscriptionNotification,
      );
    } else if (payload.voidedPurchaseNotification) {
      result = await processVoidedPurchase(
        db,
        payload.voidedPurchaseNotification,
        String(payload.eventTimeMillis || ''),
      );
    } else if (payload.testNotification) {
      result = { ok: true, test: true };
    } else {
      result = { ok: true, ignored: 'UNSUPPORTED_NOTIFICATION' };
    }
    return json(200, result);
  } catch (error) {
    console.error('calltag-rtdn-failed', {
      code: text(error?.details?.code || error?.message || 'RTDN_FAILED', 160),
    });
    // Non-2xx asks Pub/Sub to retry transient processing failures.
    return json(503, {
      ok: false,
      code: text(error?.details?.code || 'RTDN_PROCESSING_FAILED', 160),
    });
  }
}

export async function onRequestGet({ env }) {
  return json(200, {
    ok: true,
    configured: !!text(env.GOOGLE_PLAY_RTDN_SECRET, 512),
    endpoint: 'google-play-rtdn',
  });
}
