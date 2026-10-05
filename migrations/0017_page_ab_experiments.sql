-- PageRo E5-1: A/B experiment and variant model.
-- Variants are isolated snapshots. They never reuse page_revisions revision numbers and do not mutate pages/page_revisions until an explicit winner publish in E5-4.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS page_experiments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'canceled')),
  assignment_salt TEXT NOT NULL,
  assignment_version INTEGER NOT NULL DEFAULT 1,
  winner_variant_id TEXT,
  started_at TEXT,
  ended_at TEXT,
  created_by_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_page_experiments_page_status
  ON page_experiments(project_id, page_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_page_experiments_one_open
  ON page_experiments(page_id)
  WHERE status IN ('draft', 'running', 'paused');

CREATE TABLE IF NOT EXISTS page_variants (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  variant_key TEXT NOT NULL CHECK (length(variant_key) BETWEEN 1 AND 16),
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  traffic_weight INTEGER NOT NULL DEFAULT 50 CHECK (traffic_weight BETWEEN 0 AND 100),
  page_json TEXT NOT NULL,
  source_revision_id TEXT,
  source_revision INTEGER NOT NULL DEFAULT 0,
  created_by_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (experiment_id) REFERENCES page_experiments(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY (source_revision_id) REFERENCES page_revisions(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_account_id) REFERENCES accounts(id),
  UNIQUE(experiment_id, variant_key)
);

CREATE INDEX IF NOT EXISTS idx_page_variants_experiment
  ON page_variants(experiment_id, status, variant_key);

CREATE INDEX IF NOT EXISTS idx_page_variants_page
  ON page_variants(project_id, page_id, updated_at DESC);
