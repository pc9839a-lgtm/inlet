import { leadError } from './_utils.js';

export async function ensureMetaOauthSchema(db) {
  if (!db?.prepare) throw leadError('Meta OAuth storage is unavailable.', 503, 'CALLTAG_META_OAUTH_DB_REQUIRED');
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_meta_oauth_sessions (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      state_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'exchanging', 'authorized', 'completed', 'failed', 'expired')),
      user_token_envelope TEXT NOT NULL DEFAULT '',
      pages_json TEXT NOT NULL DEFAULT '[]',
      requested_scopes_json TEXT NOT NULL DEFAULT '[]',
      granted_scopes_json TEXT NOT NULL DEFAULT '[]',
      return_path TEXT NOT NULL DEFAULT '/connect',
      expires_at INTEGER NOT NULL,
      authorized_at TEXT NOT NULL DEFAULT '',
      completed_at TEXT NOT NULL DEFAULT '',
      last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_calltag_meta_oauth_owner_status
    ON calltag_meta_oauth_sessions(owner_id, status, expires_at DESC)
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_calltag_meta_oauth_expires
    ON calltag_meta_oauth_sessions(expires_at, status)
  `).run();
}
