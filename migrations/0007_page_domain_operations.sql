-- Operational retry, escalation, and scheduled recheck state for customer domains.

ALTER TABLE page_domains ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE page_domains ADD COLUMN next_retry_at TEXT;
ALTER TABLE page_domains ADD COLUMN last_error_code TEXT NOT NULL DEFAULT '';
ALTER TABLE page_domains ADD COLUMN escalated_at TEXT;
ALTER TABLE page_domains ADD COLUMN last_attempt_at TEXT;

CREATE INDEX IF NOT EXISTS idx_page_domains_retry_due
  ON page_domains(status, next_retry_at, retry_count)
  WHERE status IN ('pending', 'verifying', 'failed');

CREATE INDEX IF NOT EXISTS idx_page_domains_escalated
  ON page_domains(escalated_at, status, updated_at DESC)
  WHERE escalated_at IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_page_domains_reset_ops_on_reconnect
AFTER UPDATE OF hostname, status ON page_domains
WHEN NEW.hostname <> OLD.hostname
  OR (OLD.status = 'disconnected' AND NEW.status <> 'disconnected')
BEGIN
  UPDATE page_domains
  SET retry_count = 0,
      next_retry_at = NULL,
      last_error_code = '',
      escalated_at = NULL,
      last_attempt_at = NULL
  WHERE id = NEW.id;
END;
