-- Canonical custom-domain ownership and lifecycle mirror for PageRo pages.
--
-- Existing editor UI stores the requested hostname in:
--   $.integrations.domain.hostname
-- This migration mirrors that value into a dedicated ownership table so D1,
-- not page JSON scanning, becomes the authoritative collision boundary.
-- Provider registration / DNS / SSL verification are intentionally deferred to
-- a later patch; this migration only establishes safe ownership state.

CREATE TABLE IF NOT EXISTS page_domains (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  hostname TEXT NOT NULL DEFAULT '',
  hostname_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verifying', 'active', 'failed', 'disconnected')),
  ssl_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ssl_status IN ('not_applicable', 'pending', 'active', 'failed')),
  failure_reason TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  provider_domain_id TEXT NOT NULL DEFAULT '',
  provider_status TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT '',
  validation_status TEXT NOT NULL DEFAULT '',
  validation_method TEXT NOT NULL DEFAULT '',
  validation_name TEXT NOT NULL DEFAULT '',
  validation_value TEXT NOT NULL DEFAULT '',
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error_code TEXT NOT NULL DEFAULT '',
  escalated_at TEXT,
  last_attempt_at TEXT,
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

-- Backfill existing saved custom domains before the unique active-owner index is
-- created. If legacy JSON contains equivalent apex/www claims, keep only the
-- newest page active in the ownership mirror and mark the others disconnected.
WITH normalized AS (
  SELECT
    pages.id AS page_id,
    pages.project_id AS project_id,
    lower(trim(COALESCE(json_extract(pages.page_json, '$.integrations.domain.hostname'), ''))) AS hostname,
    CASE
      WHEN lower(trim(COALESCE(json_extract(pages.page_json, '$.integrations.domain.hostname'), ''))) LIKE 'www.%'
        THEN substr(lower(trim(COALESCE(json_extract(pages.page_json, '$.integrations.domain.hostname'), ''))), 5)
      ELSE lower(trim(COALESCE(json_extract(pages.page_json, '$.integrations.domain.hostname'), '')))
    END AS hostname_key,
    COALESCE(pages.updated_at, '') AS page_updated_at
  FROM pages
  LEFT JOIN projects ON projects.id = pages.project_id
  WHERE lower(trim(COALESCE(json_extract(pages.page_json, '$.integrations.domain.hostname'), ''))) <> ''
    AND COALESCE(projects.status, 'active') <> 'archived'
), ranked AS (
  SELECT
    normalized.*,
    row_number() OVER (
      PARTITION BY hostname_key
      ORDER BY page_updated_at DESC, page_id DESC
    ) AS owner_rank
  FROM normalized
  WHERE hostname_key <> ''
    AND hostname_key <> 'pagero.kr'
    AND hostname_key NOT LIKE '%.pagero.kr'
    AND hostname_key <> 'pages.dev'
    AND hostname_key NOT LIKE '%.pages.dev'
    AND hostname_key <> 'localhost'
    AND hostname_key NOT LIKE '%.localhost'
)
INSERT INTO page_domains (
  id, project_id, page_id, hostname, hostname_key, status, ssl_status,
  disconnected_at, created_at, updated_at
)
SELECT
  'domain_' || page_id,
  project_id,
  page_id,
  hostname,
  hostname_key,
  CASE WHEN owner_rank = 1 THEN 'pending' ELSE 'disconnected' END,
  CASE WHEN owner_rank = 1 THEN 'pending' ELSE 'not_applicable' END,
  CASE WHEN owner_rank = 1 THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM ranked;

CREATE UNIQUE INDEX IF NOT EXISTS idx_page_domains_hostname_owner
  ON page_domains(hostname_key)
  WHERE hostname_key <> '' AND status <> 'disconnected';

CREATE INDEX IF NOT EXISTS idx_page_domains_project_status
  ON page_domains(project_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_domains_retry_due
  ON page_domains(status, next_retry_at, retry_count)
  WHERE status IN ('pending', 'verifying', 'failed');

-- Reject obviously unsafe/reserved values at the database boundary. The UI may
-- normalize input, but direct API writes must not bypass these constraints.
CREATE TRIGGER IF NOT EXISTS trg_pages_domain_validate_insert
BEFORE INSERT ON pages
WHEN lower(trim(COALESCE(json_extract(NEW.page_json, '$.integrations.domain.hostname'), ''))) <> ''
  AND (
    instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), '/') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), '?') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), '#') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), '@') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), '*') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), ':') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), ' ') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), '.') = 0
    OR length(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname')))) > 253
    OR lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) = 'pagero.kr'
    OR lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) LIKE '%.pagero.kr'
    OR lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) = 'pages.dev'
    OR lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) LIKE '%.pages.dev'
    OR lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) = 'localhost'
    OR lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) LIKE '%.localhost'
  )
BEGIN
  SELECT RAISE(ABORT, 'DOMAIN_INVALID');
END;

CREATE TRIGGER IF NOT EXISTS trg_pages_domain_validate_update
BEFORE UPDATE OF page_json ON pages
WHEN lower(trim(COALESCE(json_extract(NEW.page_json, '$.integrations.domain.hostname'), ''))) <> ''
  AND (
    instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), '/') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), '?') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), '#') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), '@') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), '*') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), ':') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), ' ') > 0
    OR instr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), '.') = 0
    OR length(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname')))) > 253
    OR lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) = 'pagero.kr'
    OR lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) LIKE '%.pagero.kr'
    OR lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) = 'pages.dev'
    OR lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) LIKE '%.pages.dev'
    OR lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) = 'localhost'
    OR lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) LIKE '%.localhost'
  )
BEGIN
  SELECT RAISE(ABORT, 'DOMAIN_INVALID');
END;

-- Mirror a custom-domain claim after a page is created.
CREATE TRIGGER IF NOT EXISTS trg_pages_domain_sync_insert
AFTER INSERT ON pages
WHEN lower(trim(COALESCE(json_extract(NEW.page_json, '$.integrations.domain.hostname'), ''))) <> ''
BEGIN
  INSERT INTO page_domains (
    id, project_id, page_id, hostname, hostname_key, status, ssl_status,
    created_at, updated_at
  ) VALUES (
    'domain_' || NEW.id,
    NEW.project_id,
    NEW.id,
    lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))),
    CASE
      WHEN lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) LIKE 'www.%'
        THEN substr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), 5)
      ELSE lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname')))
    END,
    'pending',
    'pending',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )
  ON CONFLICT(page_id) DO UPDATE SET
    project_id = excluded.project_id,
    hostname = excluded.hostname,
    hostname_key = excluded.hostname_key,
    status = CASE
      WHEN page_domains.hostname_key = excluded.hostname_key
        AND page_domains.status <> 'disconnected'
        THEN page_domains.status
      ELSE 'pending'
    END,
    ssl_status = CASE
      WHEN page_domains.hostname_key = excluded.hostname_key
        AND page_domains.status <> 'disconnected'
        THEN page_domains.ssl_status
      ELSE 'pending'
    END,
    failure_reason = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.failure_reason ELSE '' END,
    provider = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.provider ELSE '' END,
    provider_domain_id = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.provider_domain_id ELSE '' END,
    provider_status = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.provider_status ELSE '' END,
    retry_count = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.retry_count ELSE 0 END,
    next_retry_at = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.next_retry_at ELSE NULL END,
    last_error_code = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.last_error_code ELSE '' END,
    escalated_at = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.escalated_at ELSE NULL END,
    disconnected_at = NULL,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
END;

-- Keep ownership synchronized whenever the saved page JSON changes.
CREATE TRIGGER IF NOT EXISTS trg_pages_domain_sync_update
AFTER UPDATE OF page_json, project_id ON pages
WHEN lower(trim(COALESCE(json_extract(NEW.page_json, '$.integrations.domain.hostname'), ''))) <> ''
BEGIN
  INSERT INTO page_domains (
    id, project_id, page_id, hostname, hostname_key, status, ssl_status,
    created_at, updated_at
  ) VALUES (
    'domain_' || NEW.id,
    NEW.project_id,
    NEW.id,
    lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))),
    CASE
      WHEN lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))) LIKE 'www.%'
        THEN substr(lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname'))), 5)
      ELSE lower(trim(json_extract(NEW.page_json, '$.integrations.domain.hostname')))
    END,
    'pending',
    'pending',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )
  ON CONFLICT(page_id) DO UPDATE SET
    project_id = excluded.project_id,
    hostname = excluded.hostname,
    hostname_key = excluded.hostname_key,
    status = CASE
      WHEN page_domains.hostname_key = excluded.hostname_key
        AND page_domains.status <> 'disconnected'
        THEN page_domains.status
      ELSE 'pending'
    END,
    ssl_status = CASE
      WHEN page_domains.hostname_key = excluded.hostname_key
        AND page_domains.status <> 'disconnected'
        THEN page_domains.ssl_status
      ELSE 'pending'
    END,
    failure_reason = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.failure_reason ELSE '' END,
    provider = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.provider ELSE '' END,
    provider_domain_id = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.provider_domain_id ELSE '' END,
    provider_status = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.provider_status ELSE '' END,
    verification_status = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.verification_status ELSE '' END,
    validation_status = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.validation_status ELSE '' END,
    validation_method = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.validation_method ELSE '' END,
    validation_name = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.validation_name ELSE '' END,
    validation_value = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.validation_value ELSE '' END,
    retry_count = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.retry_count ELSE 0 END,
    next_retry_at = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.next_retry_at ELSE NULL END,
    last_error_code = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.last_error_code ELSE '' END,
    escalated_at = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.escalated_at ELSE NULL END,
    last_attempt_at = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.last_attempt_at ELSE NULL END,
    last_checked_at = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.last_checked_at ELSE NULL END,
    last_provider_sync_at = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.last_provider_sync_at ELSE NULL END,
    connected_at = CASE WHEN page_domains.hostname_key = excluded.hostname_key THEN page_domains.connected_at ELSE NULL END,
    disconnected_at = NULL,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
END;

-- Clearing the editor hostname releases the canonical ownership claim.
CREATE TRIGGER IF NOT EXISTS trg_pages_domain_disconnect_update
AFTER UPDATE OF page_json ON pages
WHEN lower(trim(COALESCE(json_extract(NEW.page_json, '$.integrations.domain.hostname'), ''))) = ''
BEGIN
  UPDATE page_domains
  SET status = 'disconnected',
      ssl_status = 'not_applicable',
      failure_reason = '',
      next_retry_at = NULL,
      last_error_code = '',
      escalated_at = NULL,
      disconnected_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE page_id = NEW.id
    AND status <> 'disconnected';
END;

-- Archiving a project releases its active custom-domain claims. Restoring a
-- project does not auto-reconnect them; reconnection must be explicit.
CREATE TRIGGER IF NOT EXISTS trg_projects_domain_disconnect_archive
AFTER UPDATE OF status ON projects
WHEN NEW.status = 'archived' AND COALESCE(OLD.status, '') <> 'archived'
BEGIN
  UPDATE page_domains
  SET status = 'disconnected',
      ssl_status = 'not_applicable',
      next_retry_at = NULL,
      last_error_code = '',
      escalated_at = NULL,
      disconnected_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE project_id = NEW.id
    AND status <> 'disconnected';
END;
