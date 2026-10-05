import { webBillingProviderAdapterReady } from './providers/_registry.js';

const WEB_PRODUCTS = Object.freeze({
  pagero_monthly: Object.freeze({ code: 'pagero_monthly', amountKrw: 3500, currency: 'KRW' }),
  pagero_pro_monthly: Object.freeze({ code: 'pagero_pro_monthly', amountKrw: 5500, currency: 'KRW' }),
});

const ORDER_STATUSES = new Set([
  'created',
  'provider_pending',
  'paid',
  'failed',
  'cancelled',
  'expired',
  'refunded',
  'partial_refund',
]);

const MAX_WEBHOOK_SKEW_MS = 5 * 60 * 1000;

export function webProduct(productCode = '') {
  return WEB_PRODUCTS[String(productCode || '').trim()] || null;
}

export function webBillingReadiness(env = {}) {
  const provider = token(env.INLET_WEB_BILLING_PROVIDER, 48);
  const providerTokenConfigured = Boolean(String(env.INLET_WEB_BILLING_PROVIDER_TOKEN || '').trim());
  const webhookSecretConfigured = Boolean(String(env.INLET_WEB_BILLING_WEBHOOK_SECRET || '').trim());
  const orderWriteEnabled = enabled(env.INLET_WEB_BILLING_ORDER_WRITE_ENABLED);
  const chargingEnabled = enabled(env.INLET_WEB_BILLING_CHARGING_ENABLED);
  const providerConfigured = Boolean(provider && providerTokenConfigured);
  const providerAdapterReady = webBillingProviderAdapterReady(provider);
  const available = providerConfigured
    && providerAdapterReady
    && webhookSecretConfigured
    && orderWriteEnabled
    && chargingEnabled;

  let stage = 'available';
  if (!provider) stage = 'provider_selection';
  else if (!providerAdapterReady) stage = 'provider_adapter_missing';
  else if (!providerTokenConfigured) stage = 'provider_credentials';
  else if (!webhookSecretConfigured) stage = 'webhook_secret';
  else if (!orderWriteEnabled) stage = 'order_write_disabled';
  else if (!chargingEnabled) stage = 'charging_disabled';

  return {
    available,
    stage,
    provider,
    providerConfigured,
    providerAdapterReady,
    webhookConfigured: webhookSecretConfigured,
    orderWriteEnabled,
    chargingEnabled,
    contractReady: true,
  };
}

export function assertWebBillingOrderWriteReady(env = {}) {
  const readiness = webBillingReadiness(env);
  if (!readiness.providerConfigured || !readiness.webhookConfigured || !readiness.orderWriteEnabled) {
    throw webBillingError(
      '웹 결제 주문 생성은 아직 활성화되지 않았습니다.',
      503,
      'WEB_BILLING_ORDER_WRITE_DISABLED',
      { stage: readiness.stage },
    );
  }
  if (readiness.chargingEnabled) {
    return readiness;
  }
  return readiness;
}

export function assertWebBillingChargingReady(env = {}) {
  const readiness = webBillingReadiness(env);
  if (!readiness.available) {
    throw webBillingError(
      '웹 자동결제는 아직 활성화되지 않았습니다.',
      503,
      'WEB_BILLING_NOT_READY',
      { stage: readiness.stage },
    );
  }
  return readiness;
}

export function assertWebBillingProvider(request, env = {}) {
  const expected = String(env.INLET_WEB_BILLING_PROVIDER_TOKEN || '').trim();
  const supplied = String(request.headers.get('X-Pagero-Billing-Provider-Token') || '').trim();
  if (!expected || !supplied || !constantTimeEqual(expected, supplied)) {
    throw webBillingError('결제 제공자 인증이 필요합니다.', 401, 'WEB_BILLING_PROVIDER_REQUIRED');
  }
  return true;
}

export function webBillingWebhookMaxSkewMs() {
  return MAX_WEBHOOK_SKEW_MS;
}

export async function webBillingPayloadSha256(rawBody = '') {
  return sha256Hex(rawBody);
}

export async function webBillingHmacSha256(secret = '', message = '') {
  return hmacHex(secret, message);
}

export function webBillingConstantTimeEqual(left = '', right = '') {
  return constantTimeEqual(left, right);
}

export function webBillingError(message, status = 400, code = 'WEB_BILLING_ERROR', extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = { code, ...extra };
  return error;
}

export function normalizeWebOrder(row = {}) {
  const status = ORDER_STATUSES.has(String(row.status || '').toLowerCase())
    ? String(row.status).toLowerCase()
    : 'created';
  return {
    orderId: text(row.order_key, 180),
    productCode: token(row.product_code, 120),
    amountKrw: money(row.amount_krw),
    currency: token(row.currency, 12) || 'KRW',
    status,
    provider: token(row.provider, 48),
    providerOrderId: text(row.provider_order_id, 180),
    providerPaymentId: text(row.provider_payment_id, 180),
    expiresAt: iso(row.expires_at),
    paidAt: iso(row.paid_at),
    cancelledAt: iso(row.cancelled_at),
    refundedAt: iso(row.refunded_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export async function findWebOrder(db, { orderId = '', ownerId = '' } = {}) {
  const safeOrderId = text(orderId, 180);
  const safeOwnerId = text(ownerId, 120);
  if (!safeOrderId) return null;
  try {
    const row = safeOwnerId
      ? await db.prepare(`
          SELECT * FROM billing_web_orders
          WHERE order_key = ? AND owner_id = ?
          LIMIT 1
        `).bind(safeOrderId, safeOwnerId).first()
      : await db.prepare(`
          SELECT * FROM billing_web_orders
          WHERE order_key = ?
          LIMIT 1
        `).bind(safeOrderId).first();
    return row || null;
  } catch (error) {
    throw normalizeSchemaError(error);
  }
}

export async function listWebOrders(db, ownerId = '', limit = 20) {
  const safeOwnerId = text(ownerId, 120);
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(Number(limit || 20))));
  try {
    const result = await db.prepare(`
      SELECT *
      FROM billing_web_orders
      WHERE owner_id = ?
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT ?
    `).bind(safeOwnerId, safeLimit).all();
    return (Array.isArray(result?.results) ? result.results : []).map(normalizeWebOrder);
  } catch (error) {
    throw normalizeSchemaError(error);
  }
}

export async function createWebOrder(db, {
  ownerId = '',
  productCode = '',
  idempotencyKey = '',
  provider = '',
  ttlMinutes = 30,
} = {}) {
  const product = webProduct(productCode);
  const safeOwnerId = text(ownerId, 120);
  const safeKey = idempotencyToken(idempotencyKey);
  const safeProvider = token(provider, 48);
  if (!safeOwnerId) throw webBillingError('로그인이 필요합니다.', 401, 'WEB_BILLING_SESSION_REQUIRED');
  if (!product) throw webBillingError('결제 상품을 확인해주세요.', 400, 'WEB_PRODUCT_INVALID');
  if (!safeKey) throw webBillingError('결제 요청 식별자가 필요합니다.', 400, 'WEB_IDEMPOTENCY_KEY_REQUIRED');

  const expiresAt = new Date(Date.now() + Math.max(5, Math.min(60, Number(ttlMinutes || 30))) * 60 * 1000).toISOString();
  const orderId = `pwo_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db.prepare(`
      INSERT INTO billing_web_orders (
        order_key, owner_id, product_code, amount_krw, currency, status,
        idempotency_key, provider, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'KRW', 'created', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(owner_id, idempotency_key) DO NOTHING
    `).bind(
      orderId,
      safeOwnerId,
      product.code,
      product.amountKrw,
      safeKey,
      safeProvider,
      expiresAt,
    ).run();

    const row = await db.prepare(`
      SELECT * FROM billing_web_orders
      WHERE owner_id = ? AND idempotency_key = ?
      LIMIT 1
    `).bind(safeOwnerId, safeKey).first();

    if (!row) throw webBillingError('결제 주문을 만들지 못했습니다.', 503, 'WEB_ORDER_CREATE_FAILED');
    if (String(row.product_code || '') !== product.code) {
      throw webBillingError(
        '같은 결제 요청 식별자로 다른 상품을 요청할 수 없습니다.',
        409,
        'WEB_IDEMPOTENCY_CONFLICT',
      );
    }
    return normalizeWebOrder(row);
  } catch (error) {
    if (error?.details?.code) throw error;
    throw normalizeSchemaError(error);
  }
}

export async function recordWebhookReceipt(db, {
  provider = '',
  eventId = '',
  eventType = '',
  payloadSha256 = '',
} = {}) {
  try {
    const result = await db.prepare(`
      INSERT INTO billing_webhook_events (
        provider, event_id, event_type, payload_sha256,
        signature_state, processing_status, received_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'verified', 'received', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(provider, event_id) DO NOTHING
    `).bind(
      token(provider, 48),
      token(eventId, 180),
      token(eventType, 120),
      token(payloadSha256, 64),
    ).run();
    const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
    return { inserted: changes > 0, duplicate: changes === 0 };
  } catch (error) {
    throw normalizeSchemaError(error);
  }
}

function normalizeSchemaError(error) {
  const message = String(error?.message || error || '');
  if (/no such table:\s*billing_web_(orders|hook_events)/i.test(message)) {
    return webBillingError(
      '웹 결제 저장소 migration이 아직 적용되지 않았습니다.',
      503,
      'WEB_BILLING_MIGRATION_REQUIRED',
    );
  }
  return error;
}

function idempotencyToken(value = '') {
  const raw = String(value || '').trim();
  if (!/^[A-Za-z0-9._:-]{12,120}$/.test(raw)) return '';
  return raw;
}

function enabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function text(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function token(value, max = 120) {
  const raw = text(value, max);
  return /^[A-Za-z0-9._:+-]*$/.test(raw) ? raw : '';
}

function money(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

function iso(value = '') {
  const raw = text(value, 80);
  if (!raw) return '';
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function constantTimeEqual(left = '', right = '') {
  const a = String(left);
  const b = String(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

async function hmacHex(secret = '', message = '') {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(signature));
}

async function sha256Hex(value = '') {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
