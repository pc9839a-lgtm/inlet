-- CallTag referral cash isolation and commission service scoping.
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

-- Backfill CallTag relations created before service isolation. The durable
-- identity table is CallTag-only, so it safely identifies historical CallTag referrals.
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

ALTER TABLE partner_commissions ADD COLUMN service_scope TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE partner_commissions ADD COLUMN product_code TEXT NOT NULL DEFAULT '';

UPDATE partner_commissions
SET product_code = COALESCE((
  SELECT s.product_code
  FROM billing_subscriptions s
  WHERE s.id = partner_commissions.subscription_id
  LIMIT 1
), product_code)
WHERE product_code = '';

UPDATE partner_commissions
SET service_scope = CASE
  WHEN product_code IN ('call_monthly', 'message_monthly', 'all_monthly') THEN 'calltag'
  WHEN product_code IN ('pagero_monthly', 'pagero_pro_monthly', 'pagero_domain_monthly') THEN 'pagero'
  ELSE service_scope
END
WHERE service_scope = 'legacy';

CREATE INDEX IF NOT EXISTS idx_partner_commissions_service_referrer_month
ON partner_commissions(service_scope, referrer_owner_id, earned_month, status);
