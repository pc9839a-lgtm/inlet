import { ensureBillingAccount, resolveEntitlement } from './_shared.js';

export const CALLTAG_BASE_TRIAL_DAYS = 7;
export const CALLTAG_REFERRAL_BONUS_DAYS = 7;
export const CALLTAG_REFERRAL_TOTAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * CallTag launch policy:
 * - normal signup: ALL IN ONE 7-day trial
 * - signup referral code: +7 days, total 14 days
 *
 * This function is idempotent and never shortens a longer promotional expiry.
 */
export async function enforceCallTagTrialPolicy(db, ownerId = '') {
  const safeOwnerId = String(ownerId || '').trim().slice(0, 120);
  const account = await ensureBillingAccount(db, safeOwnerId);
  const referral = await db.prepare(`
    SELECT id, referral_code, bonus_days, status, applied_at
    FROM referrals
    WHERE referred_owner_id = ?
    LIMIT 1
  `).bind(safeOwnerId).first();

  const startedMs = Date.parse(String(account?.trial_started_at || '')) || Date.now();
  const bonusDays = referral?.id ? CALLTAG_REFERRAL_BONUS_DAYS : 0;
  const policyDays = CALLTAG_BASE_TRIAL_DAYS + bonusDays;
  const policyEndsAt = new Date(startedMs + policyDays * DAY_MS).toISOString();
  const existingEndsMs = Date.parse(String(account?.trial_ends_at || '')) || 0;
  const policyEndsMs = Date.parse(policyEndsAt);
  const finalEndsAt = existingEndsMs > policyEndsMs
    ? new Date(existingEndsMs).toISOString()
    : policyEndsAt;

  await db.prepare(`
    UPDATE billing_accounts
    SET referral_bonus_days = ?,
        trial_ends_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE owner_id = ?
  `).bind(bonusDays, finalEndsAt, safeOwnerId).run();

  if (referral?.id && Number(referral.bonus_days || 0) !== CALLTAG_REFERRAL_BONUS_DAYS) {
    await db.prepare(`
      UPDATE referrals
      SET bonus_days = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(CALLTAG_REFERRAL_BONUS_DAYS, referral.id).run();
  }

  return {
    baseDays: CALLTAG_BASE_TRIAL_DAYS,
    referralApplied: !!referral?.id,
    referralBonusDays: bonusDays,
    totalDays: policyDays,
    startsAt: new Date(startedMs).toISOString(),
    endsAt: finalEndsAt,
  };
}

export async function resolveCallTagEntitlement(db, ownerId = '') {
  const policy = await enforceCallTagTrialPolicy(db, ownerId);
  const entitlement = await resolveEntitlement(db, ownerId);
  entitlement.trial = {
    ...(entitlement.trial || {}),
    scope: 'all',
    baseDays: CALLTAG_BASE_TRIAL_DAYS,
    referralBonusDays: policy.referralBonusDays,
    totalDays: policy.totalDays,
    startsAt: policy.startsAt,
    endsAt: entitlement.trial?.endsAt || policy.endsAt,
  };
  return entitlement;
}
