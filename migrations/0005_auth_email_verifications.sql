-- Stores short email verification codes for signup and password reset.

CREATE TABLE IF NOT EXISTS auth_email_verifications (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'blocked')),
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_email_verifications_lookup
  ON auth_email_verifications(email, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_email_verifications_purpose
  ON auth_email_verifications(email, purpose, status, expires_at DESC);
