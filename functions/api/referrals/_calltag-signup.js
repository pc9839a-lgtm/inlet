import {
  billingError,
  ensureBillingAccount,
} from '../billing/_shared.js';
import {
  normalizeSignupReferralCode,
  validateSignupReferralCode,
} from './_signup.js';
import {
  callTagReferralForOwner,
  ensureCallTagReferralSchema,
} from './_calltag-store.js';
import {
  CALLTAG_BASE_TRIAL_DAYS,
  CALLTAG_REFERRAL_BONUS_DAYS,
  CALLTAG_REFERRAL_TOTAL_DAYS,
  enforceCallTagTrialPolicy,
} from '../billing/trial-policy.js';

export { normalizeSignupReferralCode, validateSignupReferralCode };


function normalizeReferralPhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('82') && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

function referralIdentitySecret(env = {}) {
  const secret = String(
    env.INLET_SESSION_SECRET_V2
      || env.INLET_SESSION_SECRET
      || env.INLET_API_TOKEN
      || '',
  ).trim();
  if (!secret) {
    throw billingError('추천 중복 방지 설정이 준비되지 않았습니다.', 503, 'REFERRAL_IDENTITY_SECRET_MISSING');
  }
  return secret;
}

async function referralPhoneHash(rawPhone = '', env = {}) {
  const phone = normalizeReferralPhone(rawPhone);
  if (!phone) {
    throw billingError('추천 혜택 적용을 위해 연락처가 필요합니다.', 400, 'REFERRAL_PHONE_REQUIRED');
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(referralIdentitySecret(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`calltag-referral-phone:v1:${phone}`),
  );
  return Array.from(new Uint8Array(signature))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Blocks referral-benefit reuse after reinstall, account deletion, or signup with a different email.
 * The durable ledger stores only an HMAC fingerprint of the normalized phone number, never raw PII.
 */
export async function assertCallTagReferralIdentityAvailable(db, rawPhone = '', env = {}) {
  await ensureCallTagReferralSchema(db);
  const phone = normalizeReferralPhone(rawPhone);
  const phoneHash = await referralPhoneHash(phone, env);

  const claimed = await db.prepare(`
    SELECT referred_owner_id
    FROM calltag_referral_identity_claims
    WHERE phone_hash = ?
    LIMIT 1
  `).bind(phoneHash).first();
  if (claimed?.referred_owner_id) {
    const relationship = await callTagReferralForOwner(db, claimed.referred_owner_id);
    if (relationship?.id) {
      throw billingError(
        '이 연락처는 이미 추천 혜택을 받은 이력이 있습니다.',
        409,
        'REFERRAL_PHONE_ALREADY_USED',
      );
    }

    // Legacy versions could reserve this phone because of an unrelated PageRo
    // referral. Without a CallTag relationship that stale claim must not block
    // an independent CallTag referral.
    await db.prepare(`
      DELETE FROM calltag_referral_identity_claims
      WHERE phone_hash = ?
    `).bind(phoneHash).run();
  }

  return { phoneHash };
}

/**
 * CallTag app signup only.
 * - new member using a referral code: base 7 + invitee bonus 5 = 12 days
 * - referrer: 20% cash commission on each verified CallTag paid subscription payment
 * - commission is recorded by the billing verification path, not at signup
 * - the same phone identity can receive referral benefits only once for life
 */
export async function applyCallTagSignupReferralCode(
  db,
  ownerId = '',
  rawCode = '',
  identity = {},
) {
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
  await ensureCallTagReferralSchema(db);

  const existing = await callTagReferralForOwner(db, safeOwnerId);
  if (existing?.id) {
    throw billingError('이미 추천인 등록을 완료했습니다.', 409, 'REFERRAL_ALREADY_APPLIED');
  }

  const phoneHash = String(identity.phoneHash || '').trim()
    || (await assertCallTagReferralIdentityAvailable(db, identity.phone || '', identity.env || {})).phoneHash;

  const statements = [
    db.prepare(`
      INSERT INTO calltag_referrals (
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
      INSERT INTO calltag_referral_identity_claims (
        phone_hash,
        referred_owner_id,
        created_at
      ) VALUES (?, ?, CURRENT_TIMESTAMP)
    `).bind(phoneHash, safeOwnerId),
  ];

  if (typeof db.batch === 'function') {
    await db.batch(statements);
  } else {
    // Test/local compatibility. Production Cloudflare D1 uses atomic batch().
    await statements[0].run();
    await statements[1].run();
  }

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
    referrerRewardMode: 'cash_commission',
    referrerCommissionRatePercent: 20,
  };
}
