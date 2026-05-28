-- Adds indexed event dimensions for D1 stats source/device aggregation.

ALTER TABLE events ADD COLUMN channel TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE events ADD COLUMN device TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS idx_events_project_month_channel ON events(project_id, created_month, channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_project_month_device ON events(project_id, created_month, device, created_at DESC);
