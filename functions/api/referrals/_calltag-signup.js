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
  CALLTAG_REFERRAL_TOTAL_DAYS,
  enforceCallTagTrialPolicy,
} from '../billing/trial-policy.js';

export { normalizeSignupReferralCode, validateSignupReferralCode };

/** CallTag app signup only: ALL IN ONE base 7 days + referral 7 days = total 14 days. */
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
  const existing = await db.prepare(`
    SELECT id
    FROM referrals
    WHERE referred_owner_id = ?
    LIMIT 1
  `).bind(safeOwnerId).first();
  if (existing?.id) {
    throw billingError('이미 추천인 등록을 완료했습니다.', 409, 'REFERRAL_ALREADY_APPLIED');
  }

  await db.prepare(`
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
  ).run();

  const policy = await enforceCallTagTrialPolicy(db, safeOwnerId);
  return {
    code: validated.code,
    bonusDays: CALLTAG_REFERRAL_BONUS_DAYS,
    baseDays: CALLTAG_BASE_TRIAL_DAYS,
    totalDays: CALLTAG_REFERRAL_TOTAL_DAYS,
    productCode: 'all_monthly',
    scope: 'all',
    startsAt: policy.startsAt,
    expiresAt: policy.endsAt,
  };
}
