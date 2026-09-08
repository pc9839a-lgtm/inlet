import {
  billingError,
  ensureBillingAccount,
} from '../billing/_shared.js';
import {
  normalizeSignupReferralCode,
  validateSignupReferralCode,
} from './_signup.js';
import {
  CALLTAG_BASE_TRIAL_DAYS,
  CALLTAG_REFERRAL_BONUS_DAYS,
  CALLTAG_REFERRER_REWARD_DAYS,
  CALLTAG_REFERRAL_TOTAL_DAYS,
  enforceCallTagTrialPolicy,
} from '../billing/trial-policy.js';

export { normalizeSignupReferralCode, validateSignupReferralCode };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * CallTag app signup only.
 * - new member using a referral code: base 7 + invitee bonus 7 = 14 days
 * - referrer: +5 access days for every successful unique referred signup
 * - no lifetime cap on the number of referrer rewards
 */
export async function applyCallTagSignupReferralCode(db, ownerId = '', rawCode = '') {
  const validated = await validateSignupReferralCode(db, rawCode);
  if (!validated) return null;

  const safeOwnerId = String(ownerId || '').trim().slice(0, 120);
  if (!safeOwnerId) {
    throw billingError('가입 계정 정보가 없습니다.', 400, 'REFERRAL_OWNER_REQUIRED');
  }
  if (validated.referrerOwnerId === safeOwnerId) {
    throw billingError('본인 추천인 코드는 등록할 수 없습니다.', 409, 'SELF_REFERRAL');
  }

  await ensureBillingAccount(db, safeOwnerId);
  const referrerAccount = await ensureBillingAccount(db, validated.referrerOwnerId);

  const existing = await db.prepare(`
    SELECT id
    FROM referrals
    WHERE referred_owner_id = ?
    LIMIT 1
  `).bind(safeOwnerId).first();
  if (existing?.id) {
    throw billingError('이미 추천인 등록을 완료했습니다.', 409, 'REFERRAL_ALREADY_APPLIED');
  }

  const nowMs = Date.now();
  const currentReferrerEndsMs = Date.parse(String(referrerAccount?.trial_ends_at || '')) || 0;
  const rewardBaseMs = Math.max(nowMs, currentReferrerEndsMs);
  const referrerRewardEndsAt = new Date(
    rewardBaseMs + CALLTAG_REFERRER_REWARD_DAYS * DAY_MS,
  ).toISOString();

  const statements = [
    db.prepare(`
      INSERT INTO referrals (
        referrer_owner_id,
        referred_owner_id,
        referral_code,
        bonus_days,
        status,
        applied_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 'applied', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      validated.referrerOwnerId,
      safeOwnerId,
      validated.code,
      CALLTAG_REFERRAL_BONUS_DAYS,
    ),
    db.prepare(`
      UPDATE billing_accounts
      SET referral_bonus_days = referral_bonus_days + ?,
          trial_ends_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE owner_id = ?
    `).bind(
      CALLTAG_REFERRER_REWARD_DAYS,
      referrerRewardEndsAt,
      validated.referrerOwnerId,
    ),
  ];

  if (typeof db.batch === 'function') {
    await db.batch(statements);
  } else {
    // Test/local compatibility. Production Cloudflare D1 uses atomic batch().
    await statements[0].run();
    await statements[1].run();
  }

  const policy = await enforceCallTagTrialPolicy(db, safeOwnerId);
  const referrerPolicy = await enforceCallTagTrialPolicy(db, validated.referrerOwnerId);

  return {
    code: validated.code,
    bonusDays: CALLTAG_REFERRAL_BONUS_DAYS,
    baseDays: CALLTAG_BASE_TRIAL_DAYS,
    totalDays: CALLTAG_REFERRAL_TOTAL_DAYS,
    productCode: 'all_monthly',
    scope: 'all',
    startsAt: policy.startsAt,
    expiresAt: policy.endsAt,
    referrerRewardDays: CALLTAG_REFERRER_REWARD_DAYS,
    referrerRewardUnlimited: true,
    referrerRewardExpiresAt: referrerPolicy.endsAt,
  };
}
