/**
 * CallTag-only referral relationship storage.
 *
 * PageRo keeps using the legacy referrals table. CallTag uses its own table so
 * the same account can have an independent referral relationship per service.
 */
export async function ensureCallTagReferralSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_referral_identity_claims (
      phone_hash TEXT PRIMARY KEY,
      referred_owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_calltag_referral_identity_owner
    ON calltag_referral_identity_claims(referred_owner_id)
  `).run();

  await db.prepare(`
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
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_calltag_referrals_referrer_status
    ON calltag_referrals(referrer_owner_id, status, applied_at DESC)
  `).run();

  // Backfill only relationships that were actually created by the historical
  // CallTag +5-day flow. A PageRo referral used 7 days and must not be copied.
  await db.prepare(`
    INSERT OR IGNORE INTO calltag_referrals (
      referrer_owner_id,
      referred_owner_id,
      referral_code,
      bonus_days,
      status,
      applied_at,
      first_paid_at,
      created_at,
      updated_at
    )
    SELECT
      r.referrer_owner_id,
      r.referred_owner_id,
      r.referral_code,
      5,
      r.status,
      r.applied_at,
      r.first_paid_at,
      r.created_at,
      r.updated_at
    FROM referrals r
    INNER JOIN calltag_referral_identity_claims c
      ON c.referred_owner_id = r.referred_owner_id
    INNER JOIN billing_accounts b
      ON b.owner_id = r.referred_owner_id
    WHERE r.bonus_days = 5
      AND b.referral_bonus_days = 5
  `).run();
}

export async function callTagReferralForOwner(db, ownerId = '') {
  await ensureCallTagReferralSchema(db);
  const safeOwnerId = String(ownerId || '').trim().slice(0, 120);
  if (!safeOwnerId) return null;
  return db.prepare(`
    SELECT id, referrer_owner_id, referred_owner_id, referral_code,
           bonus_days, status, applied_at, first_paid_at, created_at, updated_at
    FROM calltag_referrals
    WHERE referred_owner_id = ?
    LIMIT 1
  `).bind(safeOwnerId).first();
}
