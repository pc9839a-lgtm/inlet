-- CallTag secure sync foundation
-- Customer payloads are application-encrypted before they reach D1.

CREATE TABLE IF NOT EXISTS calltag_sync_devices (
  owner_id TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  device_label TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (owner_id, device_hash)
);

CREATE INDEX IF NOT EXISTS idx_calltag_sync_devices_owner_seen
ON calltag_sync_devices(owner_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS calltag_sync_records (
  owner_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  payload_hash TEXT NOT NULL,
  phone_search_hash TEXT NOT NULL DEFAULT '',
  deleted_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_calltag_sync_records_owner_updated
ON calltag_sync_records(owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_calltag_sync_records_owner_phone
ON calltag_sync_records(owner_id, entity_type, phone_search_hash);

CREATE TABLE IF NOT EXISTS calltag_sync_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calltag_sync_changes_owner_cursor
ON calltag_sync_changes(owner_id, id ASC);

CREATE TABLE IF NOT EXISTS calltag_sync_rate_limits (
  rate_key TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rate_key, window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_calltag_sync_rate_limits_updated
ON calltag_sync_rate_limits(updated_at);

CREATE TABLE IF NOT EXISTS calltag_security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_hash TEXT NOT NULL DEFAULT '',
  device_hash TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL,
  result_code TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calltag_security_events_created
ON calltag_security_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calltag_security_events_owner
ON calltag_security_events(owner_hash, created_at DESC);
