CREATE TABLE IF NOT EXISTS lead_blocked_submissions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  page_id TEXT,
  page_slug TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT 'rate_limited',
  risk_score INTEGER NOT NULL DEFAULT 0,
  policy_snapshot_json TEXT NOT NULL DEFAULT '{}',
  ip_hash TEXT NOT NULL DEFAULT '',
  client_id TEXT NOT NULL DEFAULT '',
  user_agent_hash TEXT NOT NULL DEFAULT '',
  contact_summary TEXT NOT NULL DEFAULT '',
  field_summary_json TEXT NOT NULL DEFAULT '{}',
  created_month TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blocked_leads_project_month
  ON lead_blocked_submissions(project_id, created_month, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blocked_leads_project_page
  ON lead_blocked_submissions(project_id, page_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blocked_leads_reason
  ON lead_blocked_submissions(project_id, reason, created_at DESC);

