-- CallTag referral ownership and cash commissions are isolated from PageRo.
CREATE TABLE IF NOT EXISTS calltag_referral_identity_claims (
  phone_hash TEXT PRIMARY KEY,
  referred_owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calltag_referral_identity_owner
ON calltag_referral_identity_claims(referred_owner_id);

CREATE TABLE IF NOT EXISTS calltag_referrals (
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

CREATE INDEX IF NOT EXISTS idx_calltag_referrals_referrer_status
ON calltag_referrals(referrer_owner_id, status, applied_at DESC);

CREATE TABLE IF NOT EXISTS calltag_partner_commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_owner_id TEXT NOT NULL,
  referred_owner_id TEXT NOT NULL,
  subscription_id INTEGER,
  product_code TEXT NOT NULL,
  payment_reference TEXT NOT NULL,
  base_amount_krw INTEGER NOT NULL DEFAULT 0,
  commission_amount_krw INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'estimated',
  earned_month TEXT NOT NULL DEFAULT '',
  confirmed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(payment_reference)
);

CREATE INDEX IF NOT EXISTS idx_calltag_commissions_referrer_month
ON calltag_partner_commissions(referrer_owner_id, earned_month, status);

CREATE TABLE IF NOT EXISTS calltag_partner_settlement_items (
  settlement_id TEXT NOT NULL,
  commission_id INTEGER NOT NULL UNIQUE,
  base_amount_krw INTEGER NOT NULL DEFAULT 0,
  commission_amount_krw INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(settlement_id, commission_id)
);

CREATE INDEX IF NOT EXISTS idx_calltag_partner_settlement_items_settlement
ON calltag_partner_settlement_items(settlement_id, commission_id);

-- Backfill CallTag relations created before service isolation. The identity ledger is CallTag-only.
INSERT OR IGNORE INTO calltag_referrals (
  referrer_owner_id, referred_owner_id, referral_code, bonus_days,
  status, applied_at, first_paid_at, created_at, updated_at
)
SELECT
  r.referrer_owner_id, r.referred_owner_id, r.referral_code, r.bonus_days,
  r.status, r.applied_at, r.first_paid_at, r.created_at, r.updated_at
FROM referrals r
JOIN calltag_referral_identity_claims c
  ON c.referred_owner_id = r.referred_owner_id;

-- Backfill any CallTag commissions written into the old shared partner ledger before isolation.
INSERT OR IGNORE INTO calltag_partner_commissions (
  referrer_owner_id, referred_owner_id, subscription_id, product_code,
  payment_reference, base_amount_krw, commission_amount_krw, status,
  earned_month, confirmed_at, created_at, updated_at
)
SELECT
  pc.referrer_owner_id,
  pc.referred_owner_id,
  pc.subscription_id,
  s.product_code,
  pc.payment_reference,
  pc.base_amount_krw,
  pc.commission_amount_krw,
  pc.status,
  pc.earned_month,
  pc.confirmed_at,
  pc.created_at,
  pc.updated_at
FROM partner_commissions pc
JOIN billing_subscriptions s
  ON s.id = pc.subscription_id
WHERE s.product_code IN ('call_monthly', 'message_monthly', 'all_monthly');

-- Preserve already-settled historical CallTag commissions if any were paid from the old shared ledger.
INSERT OR IGNORE INTO calltag_partner_settlement_items (
  settlement_id, commission_id, base_amount_krw, commission_amount_krw, created_at
)
SELECT
  psi.settlement_id,
  cpc.id,
  psi.base_amount_krw,
  psi.commission_amount_krw,
  psi.created_at
FROM partner_settlement_items psi
JOIN partner_commissions pc ON pc.id = psi.commission_id
JOIN billing_subscriptions s ON s.id = pc.subscription_id
JOIN calltag_partner_commissions cpc ON cpc.payment_reference = pc.payment_reference
WHERE s.product_code IN ('call_monthly', 'message_monthly', 'all_monthly');
