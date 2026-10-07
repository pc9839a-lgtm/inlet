const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  signupEnabled: true,
  commissionEnabled: true,
  commissionRateBps: 2000,
  baseTrialDays: 7,
  inviteeBonusDays: 5,
  minimumPayoutKrw: 10000,
  partnerCenterEnabled: true,
  partnerCenterUrl: 'https://pagero.kr/partner?service=CALLTAG',
  shareMessage: '콜태그 가입할 때 추천인 코드를 입력하면 무료체험이 {bonusDays}일 추가돼요.',
  friendBenefitMessage: '친구 혜택 · 회원가입할 때 추천인 코드를 입력하면 무료체험 +{bonusDays}일',
  benefitMessage: '내 수익 · 추천 회원의 콜태그 유료 결제액의 {rate}%',
  recurringMessage: '추천 회원이 유료 구독을 유지해 새 결제가 확인될 때마다 같은 비율로 적립됩니다.',
});

function bool(value, fallback = false) {
  if (value === true || value === 1 || String(value).trim() === '1') return true;
  if (value === false || value === 0 || String(value).trim() === '0') return false;
  return fallback;
}

function intInRange(value, fallback, min, max) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function text(value, fallback = '', max = 500) {
  const normalized = String(value ?? '').trim();
  return (normalized || fallback).slice(0, max);
}

export async function ensureCallTagReferralProgramConfig(db) {
  if (!db?.prepare) throw new Error('CallTag referral program database is required.');
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_referral_program_config (
      singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1),
      enabled INTEGER NOT NULL DEFAULT 1,
      signup_enabled INTEGER NOT NULL DEFAULT 1,
      commission_enabled INTEGER NOT NULL DEFAULT 1,
      commission_rate_bps INTEGER NOT NULL DEFAULT 2000,
      base_trial_days INTEGER NOT NULL DEFAULT 7,
      invitee_bonus_days INTEGER NOT NULL DEFAULT 5,
      minimum_payout_krw INTEGER NOT NULL DEFAULT 10000,
      partner_center_enabled INTEGER NOT NULL DEFAULT 1,
      partner_center_url TEXT NOT NULL DEFAULT 'https://pagero.kr/partner?service=CALLTAG',
      share_message TEXT NOT NULL DEFAULT '',
      friend_benefit_message TEXT NOT NULL DEFAULT '',
      benefit_message TEXT NOT NULL DEFAULT '',
      recurring_message TEXT NOT NULL DEFAULT '',
      updated_by_owner_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    INSERT OR IGNORE INTO calltag_referral_program_config (
      singleton_id, enabled, signup_enabled, commission_enabled,
      commission_rate_bps, base_trial_days, invitee_bonus_days,
      minimum_payout_krw, partner_center_enabled, partner_center_url,
      share_message, friend_benefit_message, benefit_message, recurring_message,
      created_at, updated_at
    ) VALUES (1, 1, 1, 1, 2000, 7, 5, 10000, 1,
      'https://pagero.kr/partner?service=CALLTAG',
      ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    DEFAULT_CONFIG.shareMessage,
    DEFAULT_CONFIG.friendBenefitMessage,
    DEFAULT_CONFIG.benefitMessage,
    DEFAULT_CONFIG.recurringMessage,
  ).run();
}

export async function readCallTagReferralProgramConfig(db) {
  await ensureCallTagReferralProgramConfig(db);
  const row = await db.prepare(`
    SELECT enabled, signup_enabled, commission_enabled, commission_rate_bps,
           base_trial_days, invitee_bonus_days, minimum_payout_krw,
           partner_center_enabled, partner_center_url,
           share_message, friend_benefit_message, benefit_message, recurring_message,
           updated_by_owner_id, updated_at
    FROM calltag_referral_program_config
    WHERE singleton_id = 1
    LIMIT 1
  `).first();

  return {
    enabled: bool(row?.enabled, DEFAULT_CONFIG.enabled),
    signupEnabled: bool(row?.signup_enabled, DEFAULT_CONFIG.signupEnabled),
    commissionEnabled: bool(row?.commission_enabled, DEFAULT_CONFIG.commissionEnabled),
    commissionRateBps: intInRange(row?.commission_rate_bps, DEFAULT_CONFIG.commissionRateBps, 0, 5000),
    commissionRatePercent: intInRange(row?.commission_rate_bps, DEFAULT_CONFIG.commissionRateBps, 0, 5000) / 100,
    baseTrialDays: intInRange(row?.base_trial_days, DEFAULT_CONFIG.baseTrialDays, 1, 30),
    inviteeBonusDays: intInRange(row?.invitee_bonus_days, DEFAULT_CONFIG.inviteeBonusDays, 0, 30),
    minimumPayoutKrw: intInRange(row?.minimum_payout_krw, DEFAULT_CONFIG.minimumPayoutKrw, 1000, 1000000),
    partnerCenterEnabled: bool(row?.partner_center_enabled, DEFAULT_CONFIG.partnerCenterEnabled),
    partnerCenterUrl: text(row?.partner_center_url, DEFAULT_CONFIG.partnerCenterUrl, 500),
    shareMessage: text(row?.share_message, DEFAULT_CONFIG.shareMessage, 300),
    friendBenefitMessage: text(row?.friend_benefit_message, DEFAULT_CONFIG.friendBenefitMessage, 300),
    benefitMessage: text(row?.benefit_message, DEFAULT_CONFIG.benefitMessage, 300),
    recurringMessage: text(row?.recurring_message, DEFAULT_CONFIG.recurringMessage, 300),
    updatedByOwnerId: text(row?.updated_by_owner_id, '', 120),
    updatedAt: text(row?.updated_at, '', 80),
  };
}

export async function updateCallTagReferralProgramConfig(db, input = {}, actorOwnerId = '') {
  const current = await readCallTagReferralProgramConfig(db);
  const next = {
    enabled: input.enabled === undefined ? current.enabled : bool(input.enabled, current.enabled),
    signupEnabled: input.signupEnabled === undefined ? current.signupEnabled : bool(input.signupEnabled, current.signupEnabled),
    commissionEnabled: input.commissionEnabled === undefined ? current.commissionEnabled : bool(input.commissionEnabled, current.commissionEnabled),
    commissionRateBps: input.commissionRateBps === undefined
      ? current.commissionRateBps
      : intInRange(input.commissionRateBps, current.commissionRateBps, 0, 5000),
    baseTrialDays: input.baseTrialDays === undefined
      ? current.baseTrialDays
      : intInRange(input.baseTrialDays, current.baseTrialDays, 1, 30),
    inviteeBonusDays: input.inviteeBonusDays === undefined
      ? current.inviteeBonusDays
      : intInRange(input.inviteeBonusDays, current.inviteeBonusDays, 0, 30),
    minimumPayoutKrw: input.minimumPayoutKrw === undefined
      ? current.minimumPayoutKrw
      : intInRange(input.minimumPayoutKrw, current.minimumPayoutKrw, 1000, 1000000),
    partnerCenterEnabled: input.partnerCenterEnabled === undefined
      ? current.partnerCenterEnabled
      : bool(input.partnerCenterEnabled, current.partnerCenterEnabled),
    partnerCenterUrl: input.partnerCenterUrl === undefined
      ? current.partnerCenterUrl
      : text(input.partnerCenterUrl, current.partnerCenterUrl, 500),
    shareMessage: input.shareMessage === undefined
      ? current.shareMessage
      : text(input.shareMessage, current.shareMessage, 300),
    friendBenefitMessage: input.friendBenefitMessage === undefined
      ? current.friendBenefitMessage
      : text(input.friendBenefitMessage, current.friendBenefitMessage, 300),
    benefitMessage: input.benefitMessage === undefined
      ? current.benefitMessage
      : text(input.benefitMessage, current.benefitMessage, 300),
    recurringMessage: input.recurringMessage === undefined
      ? current.recurringMessage
      : text(input.recurringMessage, current.recurringMessage, 300),
  };

  if (!/^https:\/\//i.test(next.partnerCenterUrl)) {
    throw new Error('CallTag partner center URL must use HTTPS.');
  }

  await db.prepare(`
    UPDATE calltag_referral_program_config
    SET enabled = ?,
        signup_enabled = ?,
        commission_enabled = ?,
        commission_rate_bps = ?,
        base_trial_days = ?,
        invitee_bonus_days = ?,
        minimum_payout_krw = ?,
        partner_center_enabled = ?,
        partner_center_url = ?,
        share_message = ?,
        friend_benefit_message = ?,
        benefit_message = ?,
        recurring_message = ?,
        updated_by_owner_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE singleton_id = 1
  `).bind(
    next.enabled ? 1 : 0,
    next.signupEnabled ? 1 : 0,
    next.commissionEnabled ? 1 : 0,
    next.commissionRateBps,
    next.baseTrialDays,
    next.inviteeBonusDays,
    next.minimumPayoutKrw,
    next.partnerCenterEnabled ? 1 : 0,
    next.partnerCenterUrl,
    next.shareMessage,
    next.friendBenefitMessage,
    next.benefitMessage,
    next.recurringMessage,
    text(actorOwnerId, '', 120),
  ).run();

  return readCallTagReferralProgramConfig(db);
}

export function callTagReferralProgramDefaults() {
  return { ...DEFAULT_CONFIG };
}
