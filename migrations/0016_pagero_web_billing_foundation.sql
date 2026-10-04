CREATE TABLE IF NOT EXISTS billing_web_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_key TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  amount_krw INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW',
  status TEXT NOT NULL DEFAULT 'created',
  idempotency_key TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  provider_order_id TEXT NOT NULL DEFAULT '',
  provider_payment_id TEXT NOT NULL DEFAULT '',
  failure_code TEXT NOT NULL DEFAULT '',
  failure_message TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL DEFAULT '',
  paid_at TEXT NOT NULL DEFAULT '',
  cancelled_at TEXT NOT NULL DEFAULT '',
  refunded_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(product_code IN ('pagero_monthly', 'pagero_pro_monthly')),
  CHECK(amount_krw > 0),
  CHECK(currency = 'KRW'),
  CHECK(status IN (
    'created',
    'provider_pending',
    'paid',
    'failed',
    'cancelled',
    'expired',
    'refunded',
    'partial_refund'
  )),
  UNIQUE(owner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_billing_web_orders_owner_created
ON billing_web_orders(owner_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_billing_web_orders_status_updated
ON billing_web_orders(status, updated_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_web_orders_provider_order
ON billing_web_orders(provider, provider_order_id)
WHERE provider <> '' AND provider_order_id <> '';

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT '',
  payload_sha256 TEXT NOT NULL,
  signature_state TEXT NOT NULL DEFAULT 'verified',
  processing_status TEXT NOT NULL DEFAULT 'received',
  error_code TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(signature_state IN ('verified', 'rejected')),
  CHECK(processing_status IN ('received', 'processed', 'ignored', 'failed')),
  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_status_received
ON billing_webhook_events(processing_status, received_at DESC, id DESC);
