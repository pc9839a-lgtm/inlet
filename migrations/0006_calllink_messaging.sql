-- Pagero CallLink device connection, business messaging and prepaid balance.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS calllink_connection_codes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  created_by_account_id TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_calllink_codes_project_expiry
  ON calllink_connection_codes(project_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS calllink_devices (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  account_id TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  device_key TEXT NOT NULL DEFAULT '',
  device_name TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'android',
  app_version TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'suspended')),
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  UNIQUE(project_id, device_key)
);

CREATE INDEX IF NOT EXISTS idx_calllink_devices_project_status
  ON calllink_devices(project_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS calllink_channels (
  project_id TEXT PRIMARY KEY,
  solapi_enabled INTEGER NOT NULL DEFAULT 0,
  sender_number TEXT NOT NULL DEFAULT '',
  kakao_channel_id TEXT NOT NULL DEFAULT '',
  kakao_template_id TEXT NOT NULL DEFAULT '',
  fallback_sms_enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured', 'pending', 'active', 'suspended')),
  updated_by_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS calllink_wallets (
  project_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KRW',
  low_balance_threshold INTEGER NOT NULL DEFAULT 1000,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calllink_wallet_transactions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'refund', 'adjustment')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_type TEXT NOT NULL DEFAULT '',
  reference_id TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calllink_wallet_tx_project_created
  ON calllink_wallet_transactions(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS calllink_message_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  device_id TEXT,
  provider TEXT NOT NULL DEFAULT 'solapi',
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'lms', 'mms', 'alimtalk')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  estimated_cost INTEGER NOT NULL DEFAULT 0,
  provider_group_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'partial', 'failed', 'canceled')),
  request_json TEXT NOT NULL DEFAULT '{}',
  response_json TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES calllink_devices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_calllink_message_logs_project_created
  ON calllink_message_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calllink_message_logs_status
  ON calllink_message_logs(project_id, status, created_at DESC);
