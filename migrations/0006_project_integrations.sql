CREATE TABLE IF NOT EXISTS project_integrations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'oauth',
  status TEXT NOT NULL DEFAULT 'disconnected',
  connected_email TEXT,
  external_id TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  token_json TEXT NOT NULL DEFAULT '{}',
  last_sync_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_project_integrations_project
  ON project_integrations(project_id, provider, status);
