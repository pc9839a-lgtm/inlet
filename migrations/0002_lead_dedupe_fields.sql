-- Adds lead intake dedupe/risk metadata for existing D1 databases.

ALTER TABLE leads ADD COLUMN client_id TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN ip_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN user_agent_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN phone_normalized TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN email_normalized TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN duplicate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN duplicate_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN risk_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN submitted_at TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_leads_phone_30d ON leads(project_id, page_slug, phone_normalized, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email_30d ON leads(project_id, page_slug, email_normalized, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_client_repeat ON leads(project_id, page_slug, client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_ip_short_window ON leads(project_id, page_slug, ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_duplicate ON leads(project_id, duplicate, created_at DESC);
