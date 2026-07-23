CREATE TABLE IF NOT EXISTS calllink_profiles (
  owner_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  brand_name TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calllink_profiles_phone
  ON calllink_profiles(phone);

CREATE TABLE IF NOT EXISTS calllink_entitlements (
  owner_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  plan_code TEXT NOT NULL DEFAULT '',
  paid_until TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  payment_customer_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calllink_entitlements_status
  ON calllink_entitlements(status);
