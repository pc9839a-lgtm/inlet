import { handleApiError, jsonResponse, optionsResponse } from '../_shared.js';
import {
  MIN_PAYOUT_KRW,
  PARTNER_PORTAL_METHODS,
  amount,
  availableCommissionAmount,
  commissionRatePercent,
  currentMonth,
  maskName,
  nextSettlementAt,
  normalizeService,
  partnerPortalContext,
  pendingPayoutRequest,
  productLabel,
  safeIso,
  serviceCondition,
  serviceForProduct,
} from './_portal.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, PARTNER_PORTAL_METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, PARTNER_PORTAL_METHODS);
  }
  try {
    const context = await partnerPortalContext(request, env);
    const service = normalizeService(new URL(request.url).searchParams.get('service') || 'ALL');
    const condition = serviceCondition('s', service);
    const month = currentMonth();

    const [referralStats, revenue, paid, recentResult, payoutProfile, pending] = await Promise.all([
      context.db.prepare(`
        SELECT
          COUNT(CASE WHEN ? = 'ALL' OR EXISTS (
            SELECT 1 FROM billing_subscriptions s
            WHERE s.owner_id = r.referred_owner_id AND ${condition}
          ) THEN 1 END) AS referred_count,
          COUNT(CASE WHEN EXISTS (
            SELECT 1 FROM billing_subscriptions s
            WHERE s.owner_id = r.referred_owner_id
              AND ${condition}
              AND s.verification_state = 'verified'
              AND s.status IN ('active','grace','cancelled')
              AND (s.expires_at = '' OR julianday(s.expires_at) > julianday('now'))
          ) THEN 1 END) AS paid_count
        FROM referrals r
        WHERE r.referrer_owner_id = ?
      `).bind(service, context.ownerId).first(),
      context.db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN pc.status IN ('estimated','confirmed') THEN pc.commission_amount_krw ELSE 0 END), 0) AS estimated_krw
        FROM partner_commissions pc
        LEFT JOIN billing_subscriptions s ON s.id = pc.subscription_id
        WHERE pc.referrer_owner_id = ?
          AND pc.earned_month = ?
          AND ${condition}
      `).bind(context.ownerId, month).first(),
      context.db.prepare(`
        SELECT COALESCE(SUM(psi.commission_amount_krw), 0) AS paid_krw
        FROM partner_settlement_items psi
        JOIN partner_settlements ps ON ps.settlement_id = psi.settlement_id AND ps.status = 'paid'
        JOIN partner_commissions pc ON pc.id = psi.commission_id
        LEFT JOIN billing_subscriptions s ON s.id = pc.subscription_id
        WHERE pc.referrer_owner_id = ? AND ${condition}
      `).bind(context.ownerId).first(),
      context.db.prepare(`
        SELECT
          pc.id, pc.referred_owner_id, pc.base_amount_krw, pc.commission_amount_krw,
          pc.status, pc.created_at, s.product_code, p.name AS referred_name,
          CASE WHEN EXISTS (
            SELECT 1 FROM partner_settlement_items psi
            JOIN partner_settlements ps ON ps.settlement_id = psi.settlement_id
            WHERE psi.commission_id = pc.id AND ps.status = 'paid'
          ) THEN 1 ELSE 0 END AS paid
        FROM partner_commissions pc
        LEFT JOIN billing_subscriptions s ON s.id = pc.subscription_id
        LEFT JOIN calllink_profiles p ON p.owner_id = pc.referred_owner_id
        WHERE pc.referrer_owner_id = ? AND ${condition}
        ORDER BY pc.created_at DESC, pc.id DESC
        LIMIT 5
      `).bind(context.ownerId).all(),
      context.db.prepare(`SELECT owner_id FROM partner_payout_profiles WHERE owner_id = ? LIMIT 1`).bind(context.ownerId).first(),
      pendingPayoutRequest(context.db, context.ownerId, service),
    ]);

    const available = await availableCommissionAmount(context.db, context.ownerId, service);
    const rate = await commissionRatePercent(context.db, context.ownerId);
    const recentRows = Array.isArray(recentResult?.results) ? recentResult.results : [];
    const recentEarnings = recentRows.map((row) => ({
      id: amount(row.id),
      occurredAt: safeIso(row.created_at),
      service: serviceForProduct(row.product_code),
      memberNameMasked: maskName(row.referred_name) || '추천 회원',
      productName: productLabel(row.product_code),
      paymentAmount: amount(row.base_amount_krw),
      recognizedRevenue: amount(row.base_amount_krw),
      partnerRate: row.base_amount_krw ? Math.round((Number(row.commission_amount_krw || 0) / Number(row.base_amount_krw || 1)) * 100) : rate,
      partnerEarning: amount(row.commission_amount_krw),
      status: Number(row.paid || 0) === 1
        ? 'PAID'
        : String(row.status || '').toLowerCase() === 'confirmed'
          ? 'CONFIRMED'
          : String(row.status || '').toLowerCase() === 'cancelled'
            ? 'REVERSED'
            : 'ESTIMATED',
    }));

    const profileReady = !!payoutProfile?.owner_id;
    const canRequestSettlement = available >= MIN_PAYOUT_KRW && !pending && profileReady;
    let requestDisabledReason = `${MIN_PAYOUT_KRW.toLocaleString('ko-KR')}원 이상부터 신청할 수 있습니다.`;
    if (!profileReady) requestDisabledReason = '정산정보를 먼저 저장해주세요.';
    else if (pending) requestDisabledReason = '지급 요청이 처리 중입니다.';
    else if (available >= MIN_PAYOUT_KRW) requestDisabledReason = '지급 요청이 가능합니다.';

    return jsonResponse(request, env, 200, {
      ok: true,
      service,
      month,
      referralCode: context.referral?.code || '',
      inviteUrl: context.referral?.shareUrl || '',
      referral: {
        code: context.referral?.code || '',
        inviteUrl: context.referral?.shareUrl || '',
      },
      referralCount: amount(referralStats?.referred_count),
      paidReferralCount: amount(referralStats?.paid_count),
      estimatedEarnings: amount(revenue?.estimated_krw),
      availableAmount: pending ? 0 : available,
      totalPaidAmount: amount(paid?.paid_krw),
      commissionRatePercent: rate,
      nextSettlementAt: nextSettlementAt(),
      nextSettlementLabel: '매월 15일 지급',
      canRequestSettlement,
      requestDisabledReason,
      pendingRequest: pending ? {
        requestId: String(pending.request_id || ''),
        service: String(pending.service_scope || ''),
        amount: amount(pending.amount_krw),
        status: String(pending.status || ''),
        requestedAt: safeIso(pending.requested_at),
      } : null,
      recentEarnings,
    }, PARTNER_PORTAL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_PORTAL_METHODS);
  }
}
