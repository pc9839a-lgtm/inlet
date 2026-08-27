CREATE TABLE IF NOT EXISTS calltag_google_forms_oauth_sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  state_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','authorized','completed','failed','expired')),
  refresh_token_envelope TEXT NOT NULL DEFAULT '',
  google_email TEXT NOT NULL DEFAULT '',
  scopes_json TEXT NOT NULL DEFAULT '[]',
  return_path TEXT NOT NULL DEFAULT '/api/calltag/v1/google-forms/oauth/android-return',
  expires_at INTEGER NOT NULL,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calltag_google_forms_oauth_owner_status
  ON calltag_google_forms_oauth_sessions(owner_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS calltag_google_forms_connections (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  form_title TEXT NOT NULL DEFAULT '',
  google_email TEXT NOT NULL DEFAULT '',
  refresh_token_envelope TEXT NOT NULL,
  mapping_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  last_synced_at_ms INTEGER NOT NULL DEFAULT 0,
  last_response_id TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT NOT NULL DEFAULT '',
  UNIQUE(owner_id, form_id),
  FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calltag_google_forms_owner_status
  ON calltag_google_forms_connections(owner_id, status, updated_at DESC);
