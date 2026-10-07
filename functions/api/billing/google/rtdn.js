import { assertD1, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import {
  billingError,
  ensureBillingSchema,
  googlePlayOrderPaidAmountKrw,
  verifyGoogleSubscription,
} from '../_shared.js';
import { recordReferralCommission } from '../_commissions.js';
import { callTagReferralForOwner } from '../../referrals/_calltag-store.js';

const METHODS = 'POST, OPTIONS';
const PACKAGE_NAME = 'kr.pagero.calltag';
const CHARGE_NOTIFICATION_TYPES = new Set([2, 4]);
const SUPPORTED_SUBSCRIPTION_NOTIFICATION_TYPES = new Set([
  1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 17, 18, 19, 20, 22,
]);
const TERMINAL_EVENT_STATUSES = new Set([
  'processed',
  'ignored',
  'test',
  'deferred_voided',
  'deferred_refund_review',
]);

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function noContent() {
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function retryResponse(request, env, code, message) {
  return jsonResponse(request, env, 503, {
    ok: false,
    code,
    error: message,
  }, METHODS);
}

async function sha256(value = '') {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function constantTimeEqual(left = '', right = '') {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('calltag-rtdn-compare-v1'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const [aSig, bSig] = await Promise.all([
    crypto.subtle.sign('HMAC', key, a),
    crypto.subtle.sign('HMAC', key, b),
  ]);
  const av = new Uint8Array(aSig);
  const bv = new Uint8Array(bSig);
  if (av.length !== bv.length) return false;
  let diff = 0;
  for (let index = 0; index < av.length; index++) diff |= av[index] ^ bv[index];
  return diff === 0;
}

async function assertPushAuthorized(request, env = {}) {
  const expectedToken = text(env.GOOGLE_PLAY_RTDN_VERIFICATION_TOKEN, 512);
  if (!expectedToken) {
    throw billingError(
      'Google Play RTDN verification token is not configured.',
      503,
      'PLAY_RTDN_TOKEN_NOT_CONFIGURED',
    );
  }

  const url = new URL(request.url);
  const suppliedToken = text(
    url.searchParams.get('token') || url.searchParams.get('verificationToken'),
    512,
  );
  if (!suppliedToken || !(await constantTimeEqual(suppliedToken, expectedToken))) {
    throw billingError('Google Play RTDN 인증에 실패했습니다.', 401, 'PLAY_RTDN_TOKEN_INVALID');
  }

  const expectedAudience = text(env.GOOGLE_PLAY_RTDN_AUDIENCE, 1000);
  const expectedServiceAccount = text(env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT, 320).toLowerCase();
  if (!expectedAudience && !expectedServiceAccount) return;
  if (!expectedAudience || !expectedServiceAccount) {
    throw billingError(
      'Google Play RTDN OIDC 설정이 완전하지 않습니다.',
      503,
      'PLAY_RTDN_OIDC_CONFIG_INCOMPLETE',
    );
  }

  const authorization = text(request.headers.get('Authorization'), 10000);
  const bearer = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!bearer) {
    throw billingError('Pub/Sub OIDC 토큰이 없습니다.', 401, 'PLAY_RTDN_OIDC_REQUIRED');
  }

  let response;
  try {
    response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(bearer)}`,
      {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch (error) {
    throw billingError(
      'Pub/Sub OIDC 토큰을 확인하지 못했습니다.',
      503,
      'PLAY_RTDN_OIDC_VERIFY_UNAVAILABLE',
    );
  }

  const claims = await response.json().catch(() => ({}));
  const emailVerified = claims?.email_verified === true
    || String(claims?.email_verified || '').toLowerCase() === 'true';
  const issuer = text(claims?.iss, 120);
  if (!response.ok
      || text(claims?.aud, 1000) !== expectedAudience
      || text(claims?.email, 320).toLowerCase() !== expectedServiceAccount
      || !emailVerified
      || !['accounts.google.com', 'https://accounts.google.com'].includes(issuer)) {
    throw billingError('Pub/Sub OIDC 토큰이 올바르지 않습니다.', 401, 'PLAY_RTDN_OIDC_INVALID');
  }
}

function decodePubSubData(value = '') {
  const raw = text(value, 20000);
  if (!raw) throw billingError('Pub/Sub data가 없습니다.', 400, 'PLAY_RTDN_DATA_REQUIRED');
  try {
    const binary = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw billingError('Pub/Sub data 형식이 올바르지 않습니다.', 400, 'PLAY_RTDN_DATA_INVALID');
  }
}

async function ensureRtdnSchema(db) {
  await ensureBillingSchema(db);
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS google_play_rtdn_events (
      message_id TEXT PRIMARY KEY,
      package_name TEXT NOT NULL DEFAULT '',
      event_time_millis INTEGER NOT NULL DEFAULT 0,
      publish_time TEXT NOT NULL DEFAULT '',
      event_kind TEXT NOT NULL DEFAULT '',
      notification_type INTEGER NOT NULL DEFAULT 0,
      purchase_token_hash TEXT NOT NULL DEFAULT '',
      order_id TEXT NOT NULL DEFAULT '',
      owner_id TEXT NOT NULL DEFAULT '',
      product_code TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'received',
      detail_code TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at TEXT NOT NULL DEFAULT ''
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_google_play_rtdn_token_status
    ON google_play_rtdn_events(purchase_token_hash, status, created_at DESC)
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_google_play_rtdn_order
    ON google_play_rtdn_events(order_id, event_kind, created_at DESC)
  `).run();
}

async function loadEvent(db, messageId) {
  return db.prepare(`
    SELECT message_id, status, detail_code, purchase_token_hash, order_id,
           owner_id, product_code, notification_type, event_kind
    FROM google_play_rtdn_events
    WHERE message_id = ?
    LIMIT 1
  `).bind(messageId).first();
}

async function insertEvent(db, input = {}) {
  await db.prepare(`
    INSERT OR IGNORE INTO google_play_rtdn_events (
      message_id, package_name, event_time_millis, publish_time,
      event_kind, notification_type, purchase_token_hash, order_id,
      status, detail_code, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'received', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    text(input.messageId, 240),
    text(input.packageName, 200),
    Math.max(0, Number(input.eventTimeMillis || 0)),
    text(input.publishTime, 80),
    text(input.eventKind, 80),
    Math.max(0, Number(input.notificationType || 0)),
    text(input.purchaseTokenHash, 128),
    text(input.orderId, 240),
  ).run();
  return loadEvent(db, input.messageId);
}

async function updateEvent(db, messageId, patch = {}) {
  const status = text(patch.status, 80) || 'received';
  const detailCode = text(patch.detailCode, 120);
  const ownerId = text(patch.ownerId, 120);
  const productCode = text(patch.productCode, 120);
  const purchaseTokenHash = text(patch.purchaseTokenHash, 128);
  const orderId = text(patch.orderId, 240);
  const terminal = TERMINAL_EVENT_STATUSES.has(status) || status === 'processed';
  await db.prepare(`
    UPDATE google_play_rtdn_events
    SET status = ?,
        detail_code = ?,
        owner_id = CASE WHEN ? != '' THEN ? ELSE owner_id END,
        product_code = CASE WHEN ? != '' THEN ? ELSE product_code END,
        purchase_token_hash = CASE WHEN ? != '' THEN ? ELSE purchase_token_hash END,
        order_id = CASE WHEN ? != '' THEN ? ELSE order_id END,
        processed_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE processed_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE message_id = ?
  `).bind(
    status,
    detailCode,
    ownerId, ownerId,
    productCode, productCode,
    purchaseTokenHash, purchaseTokenHash,
    orderId, orderId,
    terminal ? 1 : 0,
    messageId,
  ).run();
}

async function subscriptionForToken(db, purchaseTokenHash) {
  return db.prepare(`
    SELECT id, owner_id, product_code, order_id, external_subscription_id, status
    FROM billing_subscriptions
    WHERE channel = 'google_play'
      AND purchase_token_hash = ?
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `).bind(purchaseTokenHash).first();
}

async function refreshSubscriptionFromRtdn(env, db, row, purchaseToken) {
  await verifyGoogleSubscription(env, db, row.owner_id, {
    packageName: PACKAGE_NAME,
    productId: row.product_code,
    purchaseToken,
    orderId: row.order_id || row.external_subscription_id,
    allowInactiveState: true,
    skipChannelConflict: true,
  });
  return subscriptionForToken(db, await sha256(purchaseToken));
}

async function maybeRecordRenewalCommission(env, db, row, messageId) {
  const referral = await callTagReferralForOwner(db, row.owner_id);
  if (!referral?.id) {
    await updateEvent(db, messageId, {
      status: 'processed',
      detailCode: 'NO_CALLTAG_REFERRAL',
      ownerId: row.owner_id,
      productCode: row.product_code,
      orderId: row.order_id,
    });
    return { retry: false };
  }

  const orderId = text(row.order_id || row.external_subscription_id, 240);
  if (!orderId) {
    await updateEvent(db, messageId, {
      status: 'retry_order',
      detailCode: 'PLAY_ORDER_ID_MISSING',
      ownerId: row.owner_id,
      productCode: row.product_code,
    });
    return { retry: true, code: 'PLAY_ORDER_ID_MISSING' };
  }

  let exactAmount;
  try {
    exactAmount = await googlePlayOrderPaidAmountKrw(
      env,
      PACKAGE_NAME,
      orderId,
      row.product_code,
    );
  } catch (error) {
    exactAmount = { ok: false, reason: 'PLAY_ORDER_LOOKUP_FAILED' };
  }

  if (!exactAmount?.ok) {
    const reason = text(exactAmount?.reason || 'PLAY_ORDER_AMOUNT_UNAVAILABLE', 120);
    if (reason === 'PLAY_ORDER_NON_KRW') {
      await updateEvent(db, messageId, {
        status: 'processed',
        detailCode: reason,
        ownerId: row.owner_id,
        productCode: row.product_code,
        orderId,
      });
      return { retry: false };
    }
    await updateEvent(db, messageId, {
      status: 'retry_order',
      detailCode: reason,
      ownerId: row.owner_id,
      productCode: row.product_code,
      orderId,
    });
    return { retry: true, code: reason };
  }

  const commission = await recordReferralCommission(db, {
    referredOwnerId: row.owner_id,
    productCode: row.product_code,
    paymentReference: orderId,
    subscriptionId: row.id,
    baseAmountKrw: exactAmount.amountKrw,
    requireExactAmount: true,
    channel: 'google_play',
    status: 'confirmed',
  });

  await updateEvent(db, messageId, {
    status: 'processed',
    detailCode: commission?.created
      ? 'COMMISSION_CREATED'
      : commission?.duplicate
        ? 'COMMISSION_ALREADY_RECORDED'
        : text(commission?.reason || 'COMMISSION_NOT_CREATED', 120),
    ownerId: row.owner_id,
    productCode: row.product_code,
    orderId,
  });
  return { retry: false };
}

async function handleSubscriptionNotification(request, env, db, messageId, payload) {
  const notification = payload.subscriptionNotification || {};
  const notificationType = Number(notification.notificationType || 0);
  const purchaseToken = text(notification.purchaseToken, 4096);

  if (!SUPPORTED_SUBSCRIPTION_NOTIFICATION_TYPES.has(notificationType) || !purchaseToken) {
    await updateEvent(db, messageId, {
      status: 'ignored',
      detailCode: !purchaseToken ? 'PLAY_RTDN_TOKEN_MISSING' : 'PLAY_RTDN_TYPE_UNSUPPORTED',
    });
    return noContent();
  }

  const purchaseTokenHash = await sha256(purchaseToken);
  await updateEvent(db, messageId, {
    status: 'received',
    detailCode: '',
    purchaseTokenHash,
  });

  const existing = await subscriptionForToken(db, purchaseTokenHash);
  if (!existing?.owner_id || !existing?.product_code) {
    await updateEvent(db, messageId, {
      status: 'retry_unmatched',
      detailCode: 'PLAY_RTDN_SUBSCRIPTION_UNMATCHED',
      purchaseTokenHash,
    });
    return retryResponse(
      request,
      env,
      'PLAY_RTDN_SUBSCRIPTION_UNMATCHED',
      '아직 콜태그 계정과 연결되지 않은 Google Play 구독입니다.',
    );
  }

  let refreshed;
  try {
    refreshed = await refreshSubscriptionFromRtdn(env, db, existing, purchaseToken);
  } catch (error) {
    await updateEvent(db, messageId, {
      status: 'retry_verify',
      detailCode: text(error?.details?.code || error?.message || 'PLAY_RTDN_VERIFY_FAILED', 120),
      ownerId: existing.owner_id,
      productCode: existing.product_code,
      purchaseTokenHash,
    });
    return retryResponse(
      request,
      env,
      'PLAY_RTDN_VERIFY_FAILED',
      'Google Play 구독 상태를 다시 확인해야 합니다.',
    );
  }

  const row = refreshed?.owner_id ? refreshed : existing;
  if (CHARGE_NOTIFICATION_TYPES.has(notificationType)) {
    const commissionResult = await maybeRecordRenewalCommission(env, db, row, messageId);
    if (commissionResult.retry) {
      return retryResponse(
        request,
        env,
        commissionResult.code || 'PLAY_RTDN_COMMISSION_RETRY',
        'Google Play 결제금액 확인 후 추천수익을 다시 처리합니다.',
      );
    }
    return noContent();
  }

  await updateEvent(db, messageId, {
    status: 'processed',
    detailCode: 'SUBSCRIPTION_STATE_REFRESHED',
    ownerId: row.owner_id,
    productCode: row.product_code,
    orderId: row.order_id,
    purchaseTokenHash,
  });
  return noContent();
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, {
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      error: '허용되지 않는 요청 방식입니다.',
    }, METHODS);
  }

  try {
    await assertPushAuthorized(request, env);
    const db = assertD1(env);
    await ensureRtdnSchema(db);
    const envelope = await readJson(request);
    const message = envelope?.message && typeof envelope.message === 'object'
      ? envelope.message
      : {};
    const messageId = text(message.messageId || message.message_id, 240);
    if (!messageId) {
      throw billingError('Pub/Sub messageId가 없습니다.', 400, 'PLAY_RTDN_MESSAGE_ID_REQUIRED');
    }

    const payload = decodePubSubData(message.data);
    const packageName = text(payload?.packageName, 200);
    if (packageName && packageName !== PACKAGE_NAME) {
      throw billingError('다른 앱의 Google Play 알림입니다.', 400, 'PLAY_RTDN_PACKAGE_MISMATCH');
    }

    const eventKind = payload?.subscriptionNotification
      ? 'subscription'
      : payload?.voidedPurchaseNotification
        ? 'voided_purchase'
        : payload?.pendingRefundReviewNotification
          ? 'pending_refund_review'
          : payload?.testNotification
            ? 'test'
            : payload?.oneTimeProductNotification
              ? 'one_time_product'
              : 'unknown';

    const subscriptionType = Number(payload?.subscriptionNotification?.notificationType || 0);
    const voidedToken = text(payload?.voidedPurchaseNotification?.purchaseToken, 4096);
    const refundToken = text(payload?.pendingRefundReviewNotification?.purchaseToken, 4096);
    const purchaseToken = text(
      payload?.subscriptionNotification?.purchaseToken || voidedToken || refundToken,
      4096,
    );
    const purchaseTokenHash = purchaseToken ? await sha256(purchaseToken) : '';
    const orderId = text(
      payload?.voidedPurchaseNotification?.orderId
        || payload?.pendingRefundReviewNotification?.orderId,
      240,
    );

    const event = await insertEvent(db, {
      messageId,
      packageName: packageName || PACKAGE_NAME,
      eventTimeMillis: payload?.eventTimeMillis,
      publishTime: message.publishTime || message.publish_time,
      eventKind,
      notificationType: subscriptionType,
      purchaseTokenHash,
      orderId,
    });
    if (event && TERMINAL_EVENT_STATUSES.has(String(event.status || ''))) {
      return noContent();
    }

    if (eventKind === 'test') {
      await updateEvent(db, messageId, {
        status: 'test',
        detailCode: 'PLAY_RTDN_TEST_RECEIVED',
      });
      return noContent();
    }

    if (eventKind === 'voided_purchase') {
      await updateEvent(db, messageId, {
        status: 'deferred_voided',
        detailCode: 'STEP5_REFUND_REVERSAL_PENDING',
        purchaseTokenHash,
        orderId,
      });
      return noContent();
    }

    if (eventKind === 'pending_refund_review') {
      await updateEvent(db, messageId, {
        status: 'deferred_refund_review',
        detailCode: 'STEP5_REFUND_REVIEW_PENDING',
        purchaseTokenHash,
        orderId,
      });
      return noContent();
    }

    if (eventKind === 'one_time_product' || eventKind === 'unknown') {
      await updateEvent(db, messageId, {
        status: 'ignored',
        detailCode: eventKind === 'one_time_product'
          ? 'ONE_TIME_PRODUCT_NOT_USED'
          : 'PLAY_RTDN_EVENT_UNSUPPORTED',
        purchaseTokenHash,
        orderId,
      });
      return noContent();
    }

    return handleSubscriptionNotification(request, env, db, messageId, payload);
  } catch (error) {
    const status = Math.max(400, Number(error?.status || 500));
    return jsonResponse(request, env, status, {
      ok: false,
      code: text(error?.details?.code || error?.code || 'PLAY_RTDN_FAILED', 120),
      error: text(error?.message || 'Google Play RTDN 처리에 실패했습니다.', 500),
    }, METHODS);
  }
}
