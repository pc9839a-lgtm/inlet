const ORDER_TRANSITIONS = Object.freeze({
  created: new Set(['provider_pending', 'paid', 'failed', 'cancelled', 'expired']),
  provider_pending: new Set(['paid', 'failed', 'cancelled', 'expired']),
  paid: new Set(['partial_refund', 'refunded']),
  partial_refund: new Set(['partial_refund', 'refunded']),
  failed: new Set([]),
  cancelled: new Set([]),
  expired: new Set([]),
  refunded: new Set([]),
});

const EVENT_TYPES = new Set([
  'payment.succeeded',
  'payment.failed',
  'subscription.renewed',
  'subscription.grace',
  'subscription.cancelled',
  'refund.partial',
  'refund.full',
]);

export function normalizeWebBillingEvent(input = {}) {
  const type = token(input.type, 80);
  if (!EVENT_TYPES.has(type)) {
    const error = new Error('지원하지 않는 결제 이벤트입니다.');
    error.status = 400;
    error.details = { code: 'WEB_BILLING_EVENT_UNSUPPORTED', type };
    throw error;
  }

  return {
    type,
    eventId: token(input.eventId, 180),
    orderId: text(input.orderId, 180),
    ownerId: text(input.ownerId, 120),
    productCode: token(input.productCode, 120),
    providerPaymentId: text(input.providerPaymentId, 180),
    externalSubscriptionId: text(input.externalSubscriptionId, 240),
    amountKrw: signedMoney(input.amountKrw),
    occurredAt: iso(input.occurredAt) || new Date().toISOString(),
    nextBillingAt: iso(input.nextBillingAt),
    expiresAt: iso(input.expiresAt),
    autoRenewing: input.autoRenewing !== false,
  };
}

export function nextOrderStatus(currentStatus = '', eventType = '') {
  const current = token(currentStatus, 32);
  const event = token(eventType, 80);
  const target = event === 'payment.succeeded' || event === 'subscription.renewed'
    ? 'paid'
    : event === 'payment.failed'
      ? 'failed'
      : event === 'refund.partial'
        ? 'partial_refund'
        : event === 'refund.full'
          ? 'refunded'
          : event === 'subscription.cancelled'
            ? 'cancelled'
            : current;

  if (target === current) return current;
  const allowed = ORDER_TRANSITIONS[current] || new Set();
  if (!allowed.has(target)) {
    const error = new Error('허용되지 않는 결제 주문 상태 전이입니다.');
    error.status = 409;
    error.details = {
      code: 'WEB_BILLING_ORDER_TRANSITION_INVALID',
      currentStatus: current,
      eventType: event,
      targetStatus: target,
    };
    throw error;
  }
  return target;
}

export function subscriptionStateForEvent(eventType = '') {
  const event = token(eventType, 80);
  if (event === 'payment.succeeded' || event === 'subscription.renewed') return 'active';
  if (event === 'subscription.grace') return 'grace';
  if (event === 'subscription.cancelled') return 'cancelled';
  if (event === 'refund.full') return 'refunded';
  return '';
}

export function paymentEventForBillingEvent(event = {}) {
  const normalized = normalizeWebBillingEvent(event);
  if (normalized.type === 'payment.succeeded' || normalized.type === 'subscription.renewed') {
    return {
      eventType: 'charge',
      paymentStatus: 'paid',
      amountKrw: Math.max(0, normalized.amountKrw),
    };
  }
  if (normalized.type === 'refund.partial') {
    return {
      eventType: 'refund',
      paymentStatus: 'partial_refund',
      amountKrw: -Math.abs(normalized.amountKrw),
    };
  }
  if (normalized.type === 'refund.full') {
    return {
      eventType: 'refund',
      paymentStatus: 'refunded',
      amountKrw: -Math.abs(normalized.amountKrw),
    };
  }
  return null;
}

function signedMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number)
    ? Math.max(-Number.MAX_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, Math.round(number)))
    : 0;
}

function iso(value = '') {
  const raw = text(value, 80);
  if (!raw) return '';
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function text(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function token(value, max = 120) {
  const raw = text(value, max);
  return /^[A-Za-z0-9._:+-]*$/.test(raw) ? raw : '';
}
