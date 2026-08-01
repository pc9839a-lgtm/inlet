-- Customer custom-domain ownership, provider binding, and verification state.

CREATE TABLE IF NOT EXISTS page_domains (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  hostname TEXT NOT NULL DEFAULT '',
  domain_type TEXT NOT NULL DEFAULT 'custom' CHECK (domain_type IN ('default', 'custom')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('ready', 'pending', 'verifying', 'active', 'failed', 'disconnected')),
  ssl_status TEXT NOT NULL DEFAULT 'pending' CHECK (ssl_status IN ('not_applicable', 'pending', 'active', 'failed')),
  failure_reason TEXT NOT NULL DEFAULT '',
  verification_token_hash TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  provider_domain_id TEXT NOT NULL DEFAULT '',
  provider_status TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT '',
  validation_status TEXT NOT NULL DEFAULT '',
  validation_method TEXT NOT NULL DEFAULT '',
  validation_name TEXT NOT NULL DEFAULT '',
  validation_value TEXT NOT NULL DEFAULT '',
  last_checked_at TEXT,
  last_provider_sync_at TEXT,
  connected_at TEXT,
  disconnected_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  UNIQUE(page_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_page_domains_hostname_owner
  ON page_domains(hostname)
  WHERE hostname <> '' AND status <> 'disconnected';

CREATE INDEX IF NOT EXISTS idx_page_domains_project_status
  ON page_domains(project_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_domains_status_checked
  ON page_domains(status, last_checked_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_domains_provider_status
  ON page_domains(provider, provider_status, last_provider_sync_at DESC);
