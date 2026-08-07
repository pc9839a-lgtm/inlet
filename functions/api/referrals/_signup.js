import {
  billingError,
  ensureBillingAccount,
  ensureBillingSchema,
} from '../billing/_shared.js';

const SIGNUP_CLASSIC_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeSignupReferralCode(value = '') {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

export async function validateSignupReferralCode(db, rawCode = '') {
  const code = normalizeSignupReferralCode(rawCode);
  if (!code) return null;
  await ensureBillingSchema(db);
  const referrer = await db.prepare(`
    SELECT owner_id, code
    FROM referral_codes
    WHERE code = ?
    LIMIT 1
  `).bind(code).first();
  if (!referrer?.owner_id) {
    throw billingError('존재하지 않는 추천인 코드입니다.', 404, 'REFERRAL_CODE_NOT_FOUND');
  }
  return {
    code,
    referrerOwnerId: String(referrer.owner_id),
  };
}

export async function applySignupReferralCode(db, ownerId = '', rawCode = '') {
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

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + SIGNUP_CLASSIC_DAYS * DAY_MS);
  const startedIso = startedAt.toISOString();
  const expiresIso = expiresAt.toISOString();
  const promotionalReference = `signup-referral:${safeOwnerId}`.slice(0, 240);

  await db.batch([
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
      SIGNUP_CLASSIC_DAYS,
    ),
    db.prepare(`
      UPDATE billing_accounts
      SET referral_bonus_days = ?,
          trial_ends_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE owner_id = ?
    `).bind(SIGNUP_CLASSIC_DAYS, expiresIso, safeOwnerId),
    db.prepare(`
      INSERT OR IGNORE INTO billing_subscriptions (
        owner_id,
        product_code,
        channel,
        status,
        external_subscription_id,
        purchase_token_hash,
        order_id,
        started_at,
        next_billing_at,
        expires_at,
        auto_renewing,
        verification_state,
        last_verified_at,
        created_at,
        updated_at
      ) VALUES (?, 'pagero_monthly', 'referral', 'active', ?, ?, ?, ?, '', ?, 0, 'promotional', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      safeOwnerId,
      promotionalReference,
      promotionalReference,
      `REF-${validated.code}`,
      startedIso,
      expiresIso,
    ),
  ]);

  return {
    code: validated.code,
    classicDays: SIGNUP_CLASSIC_DAYS,
    productCode: 'pagero_monthly',
    startsAt: startedIso,
    expiresAt: expiresIso,
  };
}
