import { ensureBillingSchema } from '../billing/_shared.js';

const CALLTAG_PRODUCTS = new Set(['call_monthly', 'message_monthly', 'all_monthly']);

let schemaPromise = null;

function text(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

export function isCallTagProduct(productCode = '') {
  return CALLTAG_PRODUCTS.has(text(productCode, 120));
}

export async function ensureCallTagReferralSchema(db) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await ensureBillingSchema(db);
    for (const statement of [
      "ALTER TABLE partner_commissions ADD COLUMN service_scope TEXT NOT NULL DEFAULT 'legacy'",
      "ALTER TABLE partner_commissions ADD COLUMN product_code TEXT NOT NULL DEFAULT ''",
    ]) {
      try {
        await db.prepare(statement).run();
      } catch (error) {
        const message = String(error?.message || '').toLowerCase();
        if (!message.includes('duplicate column') && !message.includes('already exists')) throw error;
      }
    }
    await db.prepare(`
      UPDATE partner_commissions
      SET product_code = COALESCE((
        SELECT s.product_code
        FROM billing_subscriptions s
        WHERE s.id = partner_commissions.subscription_id
        LIMIT 1
      ), product_code)
      WHERE product_code = ''
    `).run();
    await db.prepare(`
      UPDATE partner_commissions
      SET service_scope = CASE
        WHEN product_code IN ('call_monthly', 'message_monthly', 'all_monthly') THEN 'calltag'
        WHEN product_code IN ('pagero_monthly', 'pagero_pro_monthly', 'pagero_domain_monthly') THEN 'pagero'
        ELSE service_scope
      END
      WHERE service_scope = 'legacy'
    `).run();

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

    // Compatibility backfill for CallTag referrals recorded before service isolation.
    await db.prepare(`
      INSERT OR IGNORE INTO calltag_referrals (
        referrer_owner_id, referred_owner_id, referral_code, bonus_days,
        status, applied_at, first_paid_at, created_at, updated_at
      )
      SELECT
        r.referrer_owner_id, r.referred_owner_id, r.referral_code, r.bonus_days,
        r.status, r.applied_at, r.first_paid_at, r.created_at, r.updated_at
      FROM referrals r
      JOIN calltag_referral_identity_claims c
        ON c.referred_owner_id = r.referred_owner_id
    `).run();
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

export async function callTagReferralForReferred(db, referredOwnerId = '') {
  await ensureCallTagReferralSchema(db);
  return db.prepare(`
    SELECT id, referrer_owner_id, referred_owner_id, referral_code,
           bonus_days, status, applied_at, first_paid_at, created_at, updated_at
    FROM calltag_referrals
    WHERE referred_owner_id = ?
    LIMIT 1
  `).bind(text(referredOwnerId, 120)).first();
}

export async function callTagReferralSummary(db, ownerId = '') {
  await ensureCallTagReferralSchema(db);
  const safeOwnerId = text(ownerId, 120);
  const counts = await db.prepare(`
    SELECT
      COUNT(*) AS referred_count,
      SUM(CASE WHEN EXISTS (
        SELECT 1
        FROM billing_subscriptions s
        WHERE s.owner_id = calltag_referrals.referred_owner_id
          AND s.product_code IN ('call_monthly', 'message_monthly', 'all_monthly')
          AND s.verification_state = 'verified'
          AND s.status IN ('active', 'grace', 'cancelled')
          AND (s.expires_at = '' OR julianday(s.expires_at) > julianday('now'))
      ) THEN 1 ELSE 0 END) AS active_paid_count
    FROM calltag_referrals
    WHERE referrer_owner_id = ?
  `).bind(safeOwnerId).first();

  const month = new Date().toISOString().slice(0, 7);
  const revenue = await db.prepare(`
    SELECT
      SUM(CASE WHEN earned_month = ? AND status IN ('estimated', 'confirmed')
        THEN commission_amount_krw ELSE 0 END) AS estimated_revenue,
      SUM(CASE WHEN status = 'confirmed'
        THEN commission_amount_krw ELSE 0 END) AS confirmed_revenue
    FROM partner_commissions
    WHERE referrer_owner_id = ?
      AND service_scope = 'calltag'
  `).bind(month, safeOwnerId).first();

  return {
    referredCount: Number(counts?.referred_count || 0),
    activePaidCount: Number(counts?.active_paid_count || 0),
    estimatedRevenueKrw: Number(revenue?.estimated_revenue || 0),
    confirmedRevenueKrw: Number(revenue?.confirmed_revenue || 0),
  };
}
