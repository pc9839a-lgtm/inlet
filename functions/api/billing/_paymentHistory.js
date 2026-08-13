const PAYMENT_STATUSES = new Set(['paid', 'refunded', 'partial_refund', 'reversed', 'pending']);
const EVENT_TYPES = new Set(['charge', 'refund', 'adjustment']);

export async function ensurePaymentHistorySchema(db) {
  if (!db?.prepare) throw new Error('PAYMENT_HISTORY_DB_REQUIRED');
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS billing_payment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT NOT NULL,
      subscription_id INTEGER,
      product_code TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT '',
      event_type TEXT NOT NULL DEFAULT 'charge',
      payment_reference TEXT NOT NULL DEFAULT '',
      amount_krw INTEGER NOT NULL DEFAULT 0,
      amount_source TEXT NOT NULL DEFAULT '',
      payment_status TEXT NOT NULL DEFAULT 'paid',
      paid_at TEXT NOT NULL DEFAULT '',
      source_month TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(channel, payment_reference, event_type)
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_billing_payment_events_owner_paid
    ON billing_payment_events(owner_id, paid_at DESC, id DESC)
  `).run();
}

export async function recordPaymentEvent(db, input = {}) {
  await ensurePaymentHistorySchema(db);
  const ownerId = text(input.ownerId, 120);
  const channel = token(input.channel, 32);
  const paymentReference = text(input.paymentReference, 240);
  const eventType = EVENT_TYPES.has(String(input.eventType || '').toLowerCase())
    ? String(input.eventType).toLowerCase()
    : 'charge';
  if (!ownerId || !channel || !paymentReference) return null;
  const statusRaw = String(input.paymentStatus || '').toLowerCase();
  const paymentStatus = PAYMENT_STATUSES.has(statusRaw) ? statusRaw : (eventType === 'refund' ? 'refunded' : 'paid');
  const amountKrw = signedMoney(input.amountKrw);
  const paidAt = iso(input.paidAt);
  const sourceMonth = month(input.sourceMonth || paidAt.slice(0, 7));
  await db.prepare(`
    INSERT INTO billing_payment_events (
      owner_id, subscription_id, product_code, channel, event_type,
      payment_reference, amount_krw, amount_source, payment_status,
      paid_at, source_month, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(channel, payment_reference, event_type) DO UPDATE SET
      owner_id = excluded.owner_id,
      subscription_id = excluded.subscription_id,
      product_code = excluded.product_code,
      amount_krw = excluded.amount_krw,
      amount_source = excluded.amount_source,
      payment_status = excluded.payment_status,
      paid_at = excluded.paid_at,
      source_month = excluded.source_month,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    ownerId,
    positiveInt(input.subscriptionId),
    token(input.productCode, 120),
    channel,
    eventType,
    paymentReference,
    amountKrw,
    token(input.amountSource, 48),
    paymentStatus,
    paidAt,
    sourceMonth,
  ).run();
  return true;
}

export async function listPaymentEvents(db, ownerId, limit = 50) {
  await ensurePaymentHistorySchema(db);
  const safeOwnerId = text(ownerId, 120);
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(Number(limit || 50))));
  if (!safeOwnerId) return [];
  const result = await db.prepare(`
    SELECT product_code, channel, event_type, amount_krw, amount_source,
           payment_status, paid_at, source_month, created_at
    FROM billing_payment_events
    WHERE owner_id = ?
    ORDER BY CASE WHEN paid_at = '' THEN 1 ELSE 0 END, datetime(paid_at) DESC, id DESC
    LIMIT ?
  `).bind(safeOwnerId, safeLimit).all();
  return (Array.isArray(result?.results) ? result.results : []).map((row) => ({
    productCode: token(row.product_code, 120),
    channel: token(row.channel, 32),
    eventType: EVENT_TYPES.has(String(row.event_type || '').toLowerCase()) ? String(row.event_type).toLowerCase() : 'charge',
    amountKrw: signedMoney(row.amount_krw),
    amountSource: token(row.amount_source, 48),
    status: PAYMENT_STATUSES.has(String(row.payment_status || '').toLowerCase()) ? String(row.payment_status).toLowerCase() : 'pending',
    paidAt: iso(row.paid_at || row.created_at),
    month: month(row.source_month || String(row.paid_at || row.created_at).slice(0, 7)),
  }));
}

export function orderFamily(value = '') {
  const raw = text(value, 240);
  if (!raw) return '';
  return raw.replace(/\.\.\d+$/i, '');
}

function positiveInt(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : null;
}

function signedMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(-Number.MAX_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, Math.round(number))) : 0;
}

function month(value = '') {
  const raw = String(value || '').trim();
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(raw) ? raw : '';
}

function iso(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function token(value, max = 120) {
  const raw = String(value ?? '').trim();
  return /^[A-Za-z0-9._:+-]*$/.test(raw) ? raw.slice(0, max) : '';
}
