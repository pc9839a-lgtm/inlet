import { ensureBillingSchema } from '../_shared.js';

const PACKAGE_NAME = 'kr.pagero.calltag';
const PRODUCT_CODES = new Set(['call_monthly', 'message_monthly']);
let cachedAccessToken = '';
let cachedAccessTokenExpiresAt = 0;

export async function onRequestPost({ request, env }) {
  if (!env?.DB) return jsonError(503, 'RTDN_DB_REQUIRED');

  const configuredSecret = String(env.GOOGLE_PLAY_RTDN_PUSH_TOKEN || '').trim();
  if (!configuredSecret) return jsonError(503, 'RTDN_PUSH_TOKEN_NOT_CONFIGURED');
  const url = new URL(request.url);
  const suppliedSecret = String(
    request.headers.get('x-calltag-rtdn-token') || url.searchParams.get('token') || '',
  ).trim();
  if (!await secretsEqual(suppliedSecret, configuredSecret)) {
    return jsonError(401, 'RTDN_UNAUTHORIZED');
  }

  let envelope;
  try {
    envelope = await request.json();
  } catch {
    return jsonError(400, 'RTDN_INVALID_JSON');
  }

  const message = envelope?.message || {};
  const encodedData = String(message?.data || '').trim();
  if (!encodedData) return jsonError(400, 'RTDN_DATA_REQUIRED');

  let notification;
  try {
    notification = JSON.parse(decodeBase64Utf8(encodedData));
  } catch {
    return jsonError(400, 'RTDN_DATA_INVALID');
  }

  await ensureBillingSchema(env.DB);
  await ensureRtdnSchema(env.DB);

  const packageName = String(notification?.packageName || '').trim();
  const messageId = String(message?.messageId || message?.message_id || '').trim()
    || await sha256(`${encodedData}:${String(envelope?.subscription || '')}`);
  const eventTime = millisToIso(notification?.eventTimeMillis);

  const existingEvent = await env.DB.prepare(`
    SELECT message_id, process_status, attempts
    FROM billing_rtdn_events
    WHERE message_id = ?
    LIMIT 1
  `).bind(messageId).first();
  if (existingEvent && terminalEventStatus(existingEvent.process_status)) {
    return emptyOk();
  }

  await env.DB.prepare(`
    INSERT INTO billing_rtdn_events (
      message_id, package_name, event_time, notification_type, purchase_token_hash,
      owner_id, product_code, play_state, mapped_status, process_status,
      attempts, error_code, received_at, processed_at
    ) VALUES (?, ?, ?, 0, '', '', '', '', '', 'received', 1, '', CURRENT_TIMESTAMP, '')
    ON CONFLICT(message_id) DO UPDATE SET
      attempts = billing_rtdn_events.attempts + 1,
      process_status = 'received',
      error_code = '',
      received_at = CURRENT_TIMESTAMP
  `).bind(messageId, packageName, eventTime).run();

  if (packageName !== PACKAGE_NAME) {
    await finishEvent(env.DB, messageId, {
      processStatus: 'rejected',
      errorCode: 'RTDN_PACKAGE_MISMATCH',
    });
    return emptyOk();
  }

  if (notification?.testNotification) {
    await finishEvent(env.DB, messageId, { processStatus: 'test' });
    console.log('Google Play RTDN test notification received', { messageId });
    return emptyOk();
  }

  const subscription = notification?.subscriptionNotification;
  if (!subscription) {
    await finishEvent(env.DB, messageId, {
      processStatus: 'ignored',
      errorCode: 'RTDN_NON_SUBSCRIPTION_EVENT',
    });
    return emptyOk();
  }

  const notificationType = Number(subscription?.notificationType || 0);
  const purchaseToken = String(subscription?.purchaseToken || '').trim();
  if (!purchaseToken) {
    await finishEvent(env.DB, messageId, {
      notificationType,
      processStatus: 'rejected',
      errorCode: 'RTDN_PURCHASE_TOKEN_REQUIRED',
    });
    return emptyOk();
  }
  const purchaseTokenHash = await sha256(purchaseToken);

  let purchase;
  try {
    purchase = await googlePlaySubscription(env, purchaseToken);
  } catch (error) {
    const code = String(error?.code || 'RTDN_PLAY_LOOKUP_FAILED');
    await finishEvent(env.DB, messageId, {
      notificationType,
      purchaseTokenHash,
      processStatus: 'retryable_error',
      errorCode: code,
    });
    console.error('Google Play RTDN lookup failed', {
      messageId,
      notificationType,
      code,
    });
    return jsonError(503, code);
  }

  const lineItems = Array.isArray(purchase?.lineItems) ? purchase.lineItems : [];
  const matched = lineItems.find((item) => PRODUCT_CODES.has(String(item?.productId || '').trim()));
  if (!matched) {
    await finishEvent(env.DB, messageId, {
      notificationType,
      purchaseTokenHash,
      playState: String(purchase?.subscriptionState || ''),
      processStatus: 'ignored',
      errorCode: 'RTDN_PRODUCT_NOT_CALLTAG',
    });
    return emptyOk();
  }

  const productCode = String(matched.productId || '').trim();
  const playState = String(purchase?.subscriptionState || '').trim();
  const mappedStatus = mapPlayState(playState);
  const expiresAt = iso(matched?.expiryTime);
  const startedAt = iso(purchase?.startTime);
  const orderId = text(purchase?.latestOrderId, 240);
  const autoRenewing = matched?.autoRenewingPlan?.autoRenewEnabled ? 1 : 0;

  let bound = await env.DB.prepare(`
    SELECT id, owner_id, product_code
    FROM billing_subscriptions
    WHERE channel = 'google_play' AND purchase_token_hash = ?
    LIMIT 1
  `).bind(purchaseTokenHash).first();

  let linkedTokenHash = '';
  if (!bound?.owner_id) {
    const linkedToken = String(purchase?.linkedPurchaseToken || '').trim();
    if (linkedToken) {
      linkedTokenHash = await sha256(linkedToken);
      bound = await env.DB.prepare(`
        SELECT id, owner_id, product_code
        FROM billing_subscriptions
        WHERE channel = 'google_play' AND purchase_token_hash = ?
        LIMIT 1
      `).bind(linkedTokenHash).first();
    }
  }

  const ownerId = String(bound?.owner_id || '').trim();
  if (!ownerId) {
    // A brand-new token can arrive before the app's verify call. We deliberately do not guess an
    // owner from RTDN. The app verification binds the token; subsequent lifecycle RTDNs will sync.
    await finishEvent(env.DB, messageId, {
      notificationType,
      purchaseTokenHash,
      productCode,
      playState,
      mappedStatus,
      processStatus: 'unbound',
      errorCode: 'RTDN_TOKEN_NOT_BOUND',
    });
    console.warn('Google Play RTDN token is not bound to a CallTag owner yet', {
      messageId,
      notificationType,
      productCode,
    });
    return emptyOk();
  }

  try {
    if (linkedTokenHash && linkedTokenHash !== purchaseTokenHash) {
      await env.DB.prepare(`
        UPDATE billing_subscriptions
        SET status = 'expired', auto_renewing = 0,
            verification_state = 'verified', last_verified_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE channel = 'google_play' AND purchase_token_hash = ? AND owner_id = ?
      `).bind(linkedTokenHash, ownerId).run();
    }

    await env.DB.prepare(`
      INSERT INTO billing_subscriptions (
        owner_id, product_code, channel, status, external_subscription_id,
        purchase_token_hash, order_id, started_at, next_billing_at, expires_at,
        auto_renewing, verification_state, last_verified_at, created_at, updated_at
      ) VALUES (?, ?, 'google_play', ?, ?, ?, ?, ?, ?, ?, ?, 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(channel, purchase_token_hash) DO UPDATE SET
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
      mappedStatus,
      orderId,
      purchaseTokenHash,
      orderId,
      startedAt,
      expiresAt,
      expiresAt,
      autoRenewing,
    ).run();

    await finishEvent(env.DB, messageId, {
      notificationType,
      purchaseTokenHash,
      ownerId,
      productCode,
      playState,
      mappedStatus,
      processStatus: 'processed',
    });
    console.log('Google Play RTDN reconciled', {
      messageId,
      notificationType,
      ownerId,
      productCode,
      playState,
      mappedStatus,
    });
    return emptyOk();
  } catch (error) {
    await finishEvent(env.DB, messageId, {
      notificationType,
      purchaseTokenHash,
      ownerId,
      productCode,
      playState,
      mappedStatus,
      processStatus: 'retryable_error',
      errorCode: 'RTDN_DB_RECONCILE_FAILED',
    });
    console.error('Google Play RTDN DB reconcile failed', {
      messageId,
      notificationType,
      message: String(error?.message || error || '').slice(0, 180),
    });
    return jsonError(503, 'RTDN_DB_RECONCILE_FAILED');
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return new Response(null, {
    status: 405,
    headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
  });
}

async function ensureRtdnSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS billing_rtdn_events (
      message_id TEXT PRIMARY KEY,
      package_name TEXT NOT NULL DEFAULT '',
      event_time TEXT NOT NULL DEFAULT '',
      notification_type INTEGER NOT NULL DEFAULT 0,
      purchase_token_hash TEXT NOT NULL DEFAULT '',
      owner_id TEXT NOT NULL DEFAULT '',
      product_code TEXT NOT NULL DEFAULT '',
      play_state TEXT NOT NULL DEFAULT '',
      mapped_status TEXT NOT NULL DEFAULT '',
      process_status TEXT NOT NULL DEFAULT 'received',
      attempts INTEGER NOT NULL DEFAULT 1,
      error_code TEXT NOT NULL DEFAULT '',
      received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at TEXT NOT NULL DEFAULT ''
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_billing_rtdn_events_status_received
    ON billing_rtdn_events(process_status, received_at DESC)
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_billing_rtdn_events_owner_received
    ON billing_rtdn_events(owner_id, received_at DESC)
  `).run();
}

async function finishEvent(db, messageId, values = {}) {
  await db.prepare(`
    UPDATE billing_rtdn_events
    SET notification_type = ?, purchase_token_hash = ?, owner_id = ?, product_code = ?,
        play_state = ?, mapped_status = ?, process_status = ?, error_code = ?,
        processed_at = CASE WHEN ? IN ('processed','ignored','unbound','rejected','test')
          THEN CURRENT_TIMESTAMP ELSE processed_at END
    WHERE message_id = ?
  `).bind(
    Number(values.notificationType || 0),
    text(values.purchaseTokenHash, 128),
    text(values.ownerId, 120),
    text(values.productCode, 120),
    text(values.playState, 80),
    text(values.mappedStatus, 40),
    text(values.processStatus || 'processed', 40),
    text(values.errorCode, 120),
    text(values.processStatus || 'processed', 40),
    messageId,
  ).run();
}

function terminalEventStatus(value = '') {
  return ['processed', 'ignored', 'unbound', 'rejected', 'test'].includes(
    String(value || '').trim().toLowerCase(),
  );
}

async function googlePlaySubscription(env, purchaseToken) {
  const accessToken = await googlePlayAccessToken(env);
  let response;
  try {
    response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    const error = new Error('PLAY_VERIFICATION_NETWORK_FAILED');
    error.code = 'PLAY_VERIFICATION_NETWORK_FAILED';
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('PLAY_VERIFICATION_FAILED');
    error.code = `PLAY_VERIFICATION_FAILED_${Number(response.status || 0)}`;
    throw error;
  }
  return body;
}

async function googlePlayAccessToken(env = {}) {
  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + 60000) {
    return cachedAccessToken;
  }
  const clientEmail = String(env.GOOGLE_PLAY_CLIENT_EMAIL || '').trim();
  const privateKey = String(env.GOOGLE_PLAY_PRIVATE_KEY || '');
  if (!clientEmail || !privateKey) {
    const error = new Error('PLAY_VERIFICATION_NOT_CONFIGURED');
    error.code = 'PLAY_VERIFICATION_NOT_CONFIGURED';
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = await signedJwt(privateKey, {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  let response;
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    const error = new Error('PLAY_AUTH_NETWORK_FAILED');
    error.code = 'PLAY_AUTH_NETWORK_FAILED';
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.access_token) {
    const error = new Error('PLAY_AUTH_FAILED');
    error.code = `PLAY_AUTH_FAILED_${Number(response.status || 0)}`;
    throw error;
  }
  cachedAccessToken = String(body.access_token);
  cachedAccessTokenExpiresAt = Date.now()
    + Math.max(60, Number(body.expires_in || 3600)) * 1000;
  return cachedAccessToken;
}

async function signedJwt(privateKey, payload) {
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const body = base64UrlJson(payload);
  const unsigned = `${header}.${body}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function importPrivateKey(value = '') {
  const pem = String(value || '').replace(/\\n/g, '\n');
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!base64) {
    const error = new Error('PLAY_PRIVATE_KEY_REQUIRED');
    error.code = 'PLAY_PRIVATE_KEY_REQUIRED';
    throw error;
  }
  const binary = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function mapPlayState(value = '') {
  const state = String(value || '').toUpperCase();
  if (state.includes('IN_GRACE_PERIOD')) return 'grace';
  if (state.includes('ACTIVE')) return 'active';
  if (state.includes('CANCELED')) return 'cancelled';
  if (state.includes('EXPIRED')) return 'expired';
  if (state.includes('PENDING')) return 'pending';
  if (state.includes('ON_HOLD') || state.includes('PAUSED')) return 'suspended';
  return 'pending';
}

function decodeBase64Utf8(value = '') {
  const binary = atob(String(value || ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sha256(value = '') {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(value || '')),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function secretsEqual(actual = '', expected = '') {
  const a = new TextEncoder().encode(String(actual || ''));
  const b = new TextEncoder().encode(String(expected || ''));
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < max; index++) {
    diff |= (a[index % Math.max(1, a.length)] || 0)
      ^ (b[index % Math.max(1, b.length)] || 0);
  }
  return diff === 0 && a.length > 0;
}

function millisToIso(value) {
  const millis = Number(value || 0);
  if (!Number.isFinite(millis) || millis <= 0) return '';
  return new Date(millis).toISOString();
}

function iso(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : raw;
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function base64UrlJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function emptyOk() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

function jsonError(status, code) {
  return new Response(JSON.stringify({ ok: false, code }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
