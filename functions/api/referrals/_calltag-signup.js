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

async function ensureReferralIdentitySchema(db) {
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
}

/**
 * Blocks referral-benefit reuse after reinstall, account deletion, or signup with a different email.
 * The durable ledger stores only an HMAC fingerprint of the normalized phone number, never raw PII.
 */
export async function assertCallTagReferralIdentityAvailable(db, rawPhone = '', env = {}) {
  await ensureReferralIdentitySchema(db);
  const phone = normalizeReferralPhone(rawPhone);
  const phoneHash = await referralPhoneHash(phone, env);

  const claimed = await db.prepare(`
    SELECT referred_owner_id
    FROM calltag_referral_identity_claims
    WHERE phone_hash = ?
    LIMIT 1
  `).bind(phoneHash).first();
  if (claimed?.referred_owner_id) {
    throw billingError(
      '이 연락처는 이미 추천 혜택을 받은 이력이 있습니다.',
      409,
      'REFERRAL_PHONE_ALREADY_USED',
    );
  }

  // Backfill protection for referrals created before the durable phone ledger existed.
  const historical = await db.prepare(`
    SELECT r.referred_owner_id
    FROM referrals r
    JOIN accounts a ON a.id = r.referred_owner_id
    WHERE a.phone = ?
    LIMIT 1
  `).bind(phone).first();
  if (historical?.referred_owner_id) {
    await db.prepare(`
      INSERT OR IGNORE INTO calltag_referral_identity_claims (
        phone_hash, referred_owner_id, created_at
      ) VALUES (?, ?, CURRENT_TIMESTAMP)
    `).bind(phoneHash, String(historical.referred_owner_id)).run();
    throw billingError(
      '이 연락처는 이미 추천 혜택을 받은 이력이 있습니다.',
      409,
      'REFERRAL_PHONE_ALREADY_USED',
    );
  }

  return { phoneHash };
}

/**
 * CallTag app signup only.
 * - new member using a referral code: base 7 + invitee bonus 5 = 12 days
 * - referrer: +5 access days for every successful unique referred signup
 * - no lifetime cap on the number of referrer rewards
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
  const referrerAccount = await ensureBillingAccount(db, validated.referrerOwnerId);
  await ensureReferralIdentitySchema(db);

  const existing = await db.prepare(`
    SELECT id
    FROM referrals
    WHERE referred_owner_id = ?
    LIMIT 1
  `).bind(safeOwnerId).first();
  if (existing?.id) {
    throw billingError('이미 추천인 등록을 완료했습니다.', 409, 'REFERRAL_ALREADY_APPLIED');
  }

  const phoneHash = String(identity.phoneHash || '').trim()
    || (await assertCallTagReferralIdentityAvailable(db, identity.phone || '', identity.env || {})).phoneHash;

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
      INSERT INTO calltag_referral_identity_claims (
        phone_hash,
        referred_owner_id,
        created_at
      ) VALUES (?, ?, CURRENT_TIMESTAMP)
    `).bind(phoneHash, safeOwnerId),
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
    await statements[2].run();
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
