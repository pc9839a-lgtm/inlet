import { leadError } from './_utils.js';

export async function ensureMetaLeadSchema(db) {
  if (!db?.prepare) throw leadError('Meta Lead Ads storage is unavailable.', 503, 'CALLTAG_META_DB_REQUIRED');
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_meta_connections (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      page_id TEXT NOT NULL UNIQUE,
      page_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error')),
      credential_envelope TEXT NOT NULL,
      token_expires_at TEXT NOT NULL DEFAULT '',
      granted_scopes_json TEXT NOT NULL DEFAULT '[]',
      last_webhook_at TEXT NOT NULL DEFAULT '',
      last_lead_at TEXT NOT NULL DEFAULT '',
      last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_calltag_meta_connections_owner_status
    ON calltag_meta_connections(owner_id, status, created_at DESC)
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_calltag_meta_connections_page_status
    ON calltag_meta_connections(page_id, status)
  `).run();
}
