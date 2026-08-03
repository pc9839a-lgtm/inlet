CREATE TABLE IF NOT EXISTS call_google_login_tickets (
  ticket TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_google_login_ticket_expiry
  ON call_google_login_tickets(expires_at, used_at);

CREATE TABLE IF NOT EXISTS calltag_push_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  app_version TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_success_at TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, device_id),
  UNIQUE(token)
);

CREATE INDEX IF NOT EXISTS idx_calltag_push_owner_enabled
  ON calltag_push_devices(owner_id, enabled, updated_at DESC);
