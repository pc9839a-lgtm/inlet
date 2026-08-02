-- Pagero lead handoff queue for the CallTag Android app.
-- The queue lives in the existing inlet-prod D1 database so Pagero can enqueue
-- a saved lead without exposing a browser-side webhook secret.

CREATE TABLE IF NOT EXISTS calltag_pagero_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL DEFAULT '',
  page_id TEXT NOT NULL DEFAULT '',
  page_slug TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  inquiry_content TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  campaign TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  submitted_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'IMPORTED', 'REJECTED')),
  delivered_at TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calltag_pagero_owner_status_id
  ON calltag_pagero_leads(owner_id, status, id);

CREATE INDEX IF NOT EXISTS idx_calltag_pagero_project_created
  ON calltag_pagero_leads(project_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_calltag_pagero_phone
  ON calltag_pagero_leads(owner_id, normalized_phone, submitted_at DESC);
