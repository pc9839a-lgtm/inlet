CREATE TABLE IF NOT EXISTS billing_accounts (
  owner_id TEXT PRIMARY KEY,
  trial_started_at TEXT NOT NULL,
  trial_ends_at TEXT NOT NULL,
  referral_bonus_days INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  external_subscription_id TEXT NOT NULL DEFAULT '',
  purchase_token_hash TEXT NOT NULL DEFAULT '',
  order_id TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL DEFAULT '',
  next_billing_at TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL DEFAULT '',
  auto_renewing INTEGER NOT NULL DEFAULT 0,
  verification_state TEXT NOT NULL DEFAULT 'pending',
  last_verified_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel, purchase_token_hash)
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_owner_status
ON billing_subscriptions(owner_id, status, expires_at DESC);

CREATE TABLE IF NOT EXISTS referral_codes (
  owner_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_owner_id TEXT NOT NULL,
  referred_owner_id TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  bonus_days INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'applied',
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_paid_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(referrer_owner_id != referred_owner_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status
ON referrals(referrer_owner_id, status, applied_at DESC);

CREATE TABLE IF NOT EXISTS partner_commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_owner_id TEXT NOT NULL,
  referred_owner_id TEXT NOT NULL,
  subscription_id INTEGER,
  payment_reference TEXT NOT NULL DEFAULT '',
  base_amount_krw INTEGER NOT NULL DEFAULT 0,
  commission_amount_krw INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'estimated',
  earned_month TEXT NOT NULL DEFAULT '',
  confirmed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(payment_reference)
);

CREATE INDEX IF NOT EXISTS idx_partner_commissions_referrer_month
ON partner_commissions(referrer_owner_id, earned_month, status);
