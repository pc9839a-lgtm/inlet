-- Unified Pagero + CallTag account finance foundation.
-- Both services must resolve the authenticated user to the same accounts.id.

CREATE TABLE IF NOT EXISTS account_finance_profiles (
  account_id TEXT PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  referral_code TEXT NOT NULL UNIQUE,
  referred_by_account_id TEXT,
  trial_bonus_days INTEGER NOT NULL DEFAULT 0,
  payout_status TEXT NOT NULL DEFAULT 'unregistered',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (referred_by_account_id) REFERENCES accounts(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_finance_profiles_email
  ON account_finance_profiles(lower(email));

CREATE TABLE IF NOT EXISTS account_subscriptions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  service TEXT NOT NULL CHECK (service IN ('pagero', 'calltag')),
  plan_code TEXT NOT NULL DEFAULT 'free',
  plan_name TEXT NOT NULL DEFAULT '',
  amount_krw INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'inactive',
  provider TEXT NOT NULL DEFAULT '',
  provider_subscription_id TEXT NOT NULL DEFAULT '',
  current_period_start TEXT NOT NULL DEFAULT '',
  current_period_end TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (account_id, service),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_account_subscriptions_account
  ON account_subscriptions(account_id, service, status);

CREATE TABLE IF NOT EXISTS account_referrals (
  id TEXT PRIMARY KEY,
  referrer_account_id TEXT NOT NULL,
  referred_account_id TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  commission_rate_bps INTEGER NOT NULL DEFAULT 2000,
  bonus_days INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active',
  registered_at TEXT NOT NULL,
  qualified_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (referrer_account_id) REFERENCES accounts(id),
  FOREIGN KEY (referred_account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_account_referrals_referrer
  ON account_referrals(referrer_account_id, status, registered_at);

CREATE TABLE IF NOT EXISTS account_finance_ledger (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  service TEXT NOT NULL CHECK (service IN ('pagero', 'calltag', 'combined')),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('charge', 'refund', 'commission', 'payout', 'adjustment')),
  amount_krw INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  related_account_id TEXT NOT NULL DEFAULT '',
  provider_ref TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL,
  available_at TEXT NOT NULL DEFAULT '',
  paid_at TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_account_finance_ledger_account
  ON account_finance_ledger(account_id, status, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_finance_ledger_provider_ref
  ON account_finance_ledger(provider_ref, entry_type, service);
