-- Inlet production schema for Cloudflare D1.
-- JSONL remains the local fallback until the D1 adapter is wired into runtime routes.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  email_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_account_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  client_email TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'free',
  billing_status TEXT NOT NULL DEFAULT 'trial' CHECK (billing_status IN ('trial', 'active', 'past_due', 'canceled', 'expired', 'transfer_pending')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (owner_account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_account_id);
CREATE INDEX IF NOT EXISTS idx_projects_billing_status ON projects(billing_status);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('master', 'client_admin', 'manager')),
  access_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'removed')),
  invited_by_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (invited_by_account_id) REFERENCES accounts(id),
  UNIQUE(project_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_account ON project_members(account_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_role ON project_members(project_id, role, status);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  name TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  access_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by_account_id TEXT NOT NULL,
  accepted_account_id TEXT,
  expires_at TEXT,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by_account_id) REFERENCES accounts(id),
  FOREIGN KEY (accepted_account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_invites_project_status ON invites(project_id, status);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  page_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pages_project ON pages(project_id);

CREATE TABLE IF NOT EXISTS page_revisions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  page_json TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_by_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id),
  UNIQUE(page_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_page_revisions_page_created ON page_revisions(page_id, created_at DESC);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  page_id TEXT,
  page_slug TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'lead',
  status TEXT NOT NULL DEFAULT 'new',
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  contact_key TEXT NOT NULL DEFAULT '',
  values_json TEXT NOT NULL DEFAULT '{}',
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  source_url TEXT NOT NULL DEFAULT '',
  created_month TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_project_month ON leads(project_id, created_month, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_project_status ON leads(project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_contact_dedupe ON leads(project_id, contact_key, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_delivery_status ON leads(project_id, delivery_status, created_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  page_id TEXT,
  page_slug TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL,
  visitor_id TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  dedupe_key TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_month TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_project_month_type ON events(project_id, created_month, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_dedupe ON events(project_id, dedupe_key, created_at DESC);

CREATE TABLE IF NOT EXISTS delivery_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'timeout', 'dead-letter')),
  retryable INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  next_retry_at TEXT,
  created_month TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_project_month ON delivery_logs(project_id, created_month, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_retry ON delivery_logs(project_id, retryable, next_retry_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_logs_idempotency ON delivery_logs(project_id, idempotency_key) WHERE idempotency_key <> '';

CREATE TABLE IF NOT EXISTS ai_drafts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  prompt_hash TEXT NOT NULL DEFAULT '',
  draft_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'applied', 'deleted')),
  created_by_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_drafts_project_created ON ai_drafts(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'toss',
  provider_customer_id TEXT NOT NULL DEFAULT '',
  provider_subscription_id TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status, current_period_end);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  subscription_id TEXT,
  provider TEXT NOT NULL DEFAULT 'toss',
  provider_payment_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KRW',
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'canceled', 'refunded')),
  paid_at TEXT,
  raw_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_project_created ON payments(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at DESC);

CREATE TABLE IF NOT EXISTS ownership_transfer_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  from_account_id TEXT NOT NULL,
  to_account_id TEXT NOT NULL,
  requested_by_account_id TEXT NOT NULL,
  approved_by_account_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('requested', 'waiting_billing_clearance', 'approved', 'rejected', 'completed', 'canceled')),
  billing_clearance_status TEXT NOT NULL DEFAULT 'not_checked' CHECK (billing_clearance_status IN ('not_checked', 'clear', 'active_subscription', 'past_due')),
  note TEXT NOT NULL DEFAULT '',
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  approved_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (from_account_id) REFERENCES accounts(id),
  FOREIGN KEY (to_account_id) REFERENCES accounts(id),
  FOREIGN KEY (requested_by_account_id) REFERENCES accounts(id),
  FOREIGN KEY (approved_by_account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_project_status ON ownership_transfer_requests(project_id, status);
CREATE INDEX IF NOT EXISTS idx_transfer_target_status ON ownership_transfer_requests(to_account_id, status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  actor_account_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_project_created ON audit_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON audit_logs(actor_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_created ON audit_logs(action, created_at DESC);

