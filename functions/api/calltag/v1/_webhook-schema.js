import { ensureUniversalLeadSchema } from './_schema.js';
import { leadError } from './_utils.js';

const WEBHOOK_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS calltag_webhook_connections (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    source_name TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'custom_webhook',
    endpoint_prefix TEXT NOT NULL,
    endpoint_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    mapping_version INTEGER NOT NULL DEFAULT 0,
    mapping_json TEXT NOT NULL DEFAULT '{}',
    raw_retention_days INTEGER NOT NULL DEFAULT 7 CHECK (raw_retention_days BETWEEN 1 AND 30),
    sample_count INTEGER NOT NULL DEFAULT 0,
    last_received_at TEXT NOT NULL DEFAULT '',
    last_mapped_at TEXT NOT NULL DEFAULT '',
    last_error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_calltag_webhook_connections_owner_status
    ON calltag_webhook_connections(owner_id, status, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS calltag_webhook_mapping_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    mapping_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connection_id, version),
    FOREIGN KEY (connection_id) REFERENCES calltag_webhook_connections(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_calltag_webhook_mapping_owner_connection
    ON calltag_webhook_mapping_versions(owner_id, connection_id, version DESC)`,
  `CREATE TABLE IF NOT EXISTS calltag_webhook_raw_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL UNIQUE,
    connection_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL DEFAULT '',
    payload_sha256 TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    mapping_version INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'MAPPING_REQUIRED', 'MAPPED', 'REJECTED')),
    canonical_event_id TEXT NOT NULL DEFAULT '',
    error_code TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    received_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (connection_id) REFERENCES calltag_webhook_connections(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_calltag_webhook_raw_owner_connection_id
    ON calltag_webhook_raw_events(owner_id, connection_id, id DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_calltag_webhook_raw_expiry
    ON calltag_webhook_raw_events(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_calltag_webhook_raw_status
    ON calltag_webhook_raw_events(owner_id, status, id DESC)`,
];

export async function ensureWebhookSchema(db) {
  if (!db?.prepare) throw leadError('Webhook database is not configured.', 503, 'CALLTAG_WEBHOOK_DB_REQUIRED');
  await ensureUniversalLeadSchema(db);
  for (const statement of WEBHOOK_SCHEMA_STATEMENTS) await db.prepare(statement).run();
}

export async function cleanupExpiredWebhookPayloads(db) {
  await ensureWebhookSchema(db);
  try {
    const result = await db.prepare(`
      DELETE FROM calltag_webhook_raw_events
      WHERE expires_at != '' AND datetime(expires_at) < CURRENT_TIMESTAMP
    `).run();
    return Number(result?.meta?.changes || 0);
  } catch {
    return 0;
  }
}
