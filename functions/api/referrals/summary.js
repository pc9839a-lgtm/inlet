import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../_shared.js';
import { CALL_METHODS, callSession } from '../call/_shared.js';
import { ensureCallTagReferralSchema } from './_calltag-store.js';
import {
  readCallTagReferralProgramConfig,
  renderCallTagReferralProgramText,
} from './_calltag-program.js';

const CALLTAG_PRODUCTS_SQL = "'call_monthly', 'message_monthly', 'all_monthly'";

function text(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

async function callTagReferralSummary(db, ownerId = '') {
  await ensureCallTagReferralSchema(db);
  const safeOwnerId = text(ownerId);
  const month = new Date().toISOString().slice(0, 7);
  const program = await readCallTagReferralProgramConfig(db);

  const counts = await db.prepare(`
    SELECT
      COUNT(DISTINCT r.id) AS referred_count,
      COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1
        FROM billing_subscriptions s
        WHERE s.owner_id = r.referred_owner_id
          AND s.product_code IN (${CALLTAG_PRODUCTS_SQL})
          AND s.verification_state = 'verified'
          AND s.status IN ('active', 'grace', 'cancelled')
          AND (s.expires_at = '' OR julianday(s.expires_at) > julianday('now'))
      ) THEN r.referred_owner_id END) AS active_paid_count
    FROM calltag_referrals r
    WHERE r.referrer_owner_id = ?
  `).bind(safeOwnerId).first();

  const revenue = await db.prepare(`
    SELECT
      SUM(CASE WHEN pc.earned_month = ? AND pc.status IN ('estimated', 'confirmed')
        THEN pc.commission_amount_krw ELSE 0 END) AS estimated_revenue,
      SUM(CASE WHEN pc.status = 'confirmed'
        THEN pc.commission_amount_krw ELSE 0 END) AS confirmed_revenue
    FROM partner_commissions pc
    INNER JOIN calltag_referrals r
      ON r.referred_owner_id = pc.referred_owner_id
     AND r.referrer_owner_id = pc.referrer_owner_id
    INNER JOIN billing_subscriptions s
      ON s.id = pc.subscription_id
     AND s.product_code IN (${CALLTAG_PRODUCTS_SQL})
    WHERE pc.referrer_owner_id = ?
  `).bind(month, safeOwnerId).first();

  return {
    scope: 'calltag',
    referredCount: Number(counts?.referred_count || 0),
    activePaidCount: Number(counts?.active_paid_count || 0),
    estimatedRevenueKrw: Number(revenue?.estimated_revenue || 0),
    confirmedRevenueKrw: Number(revenue?.confirmed_revenue || 0),
    programEnabled: program.enabled,
    signupEnabled: program.signupEnabled,
    commissionEnabled: program.commissionEnabled,
    commissionRatePercent: program.commissionRatePercent,
    friendBonusDays: program.inviteeBonusDays,
    baseTrialDays: program.baseTrialDays,
    minimumPayoutKrw: program.minimumPayoutKrw,
    rewardMode: 'cash_commission',
    partnerCenterAvailable: program.partnerCenterEnabled,
    partnerCenterUrl: program.partnerCenterUrl,
    shareMessage: renderCallTagReferralProgramText(program, program.shareMessage),
    friendBenefitMessage: renderCallTagReferralProgramText(program, program.friendBenefitMessage),
    benefitMessage: renderCallTagReferralProgramText(program, program.benefitMessage),
    recurringMessage: renderCallTagReferralProgramText(program, program.recurringMessage),
    pausedMessage: renderCallTagReferralProgramText(program, program.pausedMessage),
  };
}

// CallTag's native app must never mix PageRo referrals or commissions into this summary.
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALL_METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, CALL_METHODS);
  }
  try {
    const db = assertD1(env);
    const session = await callSession(request, env);
    const summary = await callTagReferralSummary(db, session.ownerId);
    return jsonResponse(request, env, 200, { ok: true, summary }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
