-- CallTag Universal Lead Intake core (Phase 0/1)
-- Canonical customer + inquiry event store. API keys are stored as SHA-256 hashes only.

CREATE TABLE IF NOT EXISTS calltag_lead_customers (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  first_source_type TEXT NOT NULL DEFAULT '',
  first_source_name TEXT NOT NULL DEFAULT '',
  first_source_at INTEGER NOT NULL DEFAULT 0,
  last_source_type TEXT NOT NULL DEFAULT '',
  last_source_name TEXT NOT NULL DEFAULT '',
  last_source_at INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, normalized_phone),
  FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calltag_lead_customers_owner_phone
  ON calltag_lead_customers(owner_id, normalized_phone);

CREATE TABLE IF NOT EXISTS calltag_lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  connection_id TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL DEFAULT '',
  dedupe_key TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'custom_api',
  source_name TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  source_json TEXT NOT NULL DEFAULT '{}',
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  inquiry_content TEXT NOT NULL DEFAULT '',
  inquiry_fields_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  submitted_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACCEPTED' CHECK (status IN ('ACCEPTED', 'DELIVERED', 'IMPORTED', 'REJECTED')),
  delivered_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, connection_id, event_id),
  UNIQUE(owner_id, dedupe_key),
  FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES calltag_lead_customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calltag_lead_events_owner_status_id
  ON calltag_lead_events(owner_id, status, id);
CREATE INDEX IF NOT EXISTS idx_calltag_lead_events_owner_customer_submitted
  ON calltag_lead_events(owner_id, customer_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_calltag_lead_events_owner_source_submitted
  ON calltag_lead_events(owner_id, source_type, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_calltag_lead_events_owner_connection
  ON calltag_lead_events(owner_id, connection_id, id DESC);

CREATE TABLE IF NOT EXISTS calltag_api_keys (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  rotated_from_id TEXT NOT NULL DEFAULT '',
  last_used_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calltag_api_keys_owner_status
  ON calltag_api_keys(owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calltag_api_keys_owner_connection
  ON calltag_api_keys(owner_id, connection_id, created_at DESC);

CREATE TABLE IF NOT EXISTS calltag_lead_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  api_key_id TEXT NOT NULL DEFAULT '',
  event_id TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT '',
  status_code INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calltag_lead_audit_owner_created
  ON calltag_lead_audit(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calltag_lead_audit_key_created
  ON calltag_lead_audit(api_key_id, created_at DESC);
