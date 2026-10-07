import {
  adminErrorResponse,
  adminJson,
  adminOptions,
  maskEmail,
  maskPhone,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';
import { isCalltagFinanceAdmin } from './_financeSecurity.js';
import { ensureBillingSchema } from '../../billing/_shared.js';
import { ensurePartnerFinanceSchema, normalizeSettlementMonth } from '../../billing/_partnerFinance.js';
import { ensurePartnerPortalSchema } from '../../partner/_portal.js';
import { ensureCallTagReferralSchema } from '../../referrals/_calltag-ledger.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') {
    return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const identity = await requireCalltagAdmin(request, env);
    const month = normalizeSettlementMonth(
      new URL(request.url).searchParams.get('month') || '',
    ) || new Date().toISOString().slice(0, 7);

    await Promise.all([
      ensureBillingSchema(env.DB),
      ensurePartnerFinanceSchema(env.DB),
      ensurePartnerPortalSchema(env.DB),
      ensureCallTagReferralSchema(env.DB),
    ]);

    const result = await env.DB.prepare(`
      WITH partner_ids AS (
        SELECT owner_id FROM partner_profiles
        UNION
        SELECT referrer_owner_id AS owner_id FROM calltag_referrals
        UNION
        SELECT referrer_owner_id AS owner_id FROM calltag_partner_commissions
        UNION
        SELECT r.referrer_owner_id AS owner_id
        FROM referrals r
        WHERE EXISTS (
          SELECT 1
          FROM billing_subscriptions s
          WHERE s.owner_id = r.referred_owner_id
            AND s.product_code IN ('pagero_monthly','pagero_pro_monthly','pagero_domain_monthly')
        )
        UNION
        SELECT pc.referrer_owner_id AS owner_id
        FROM partner_commissions pc
        JOIN billing_subscriptions s ON s.id = pc.subscription_id
        WHERE s.product_code IN ('pagero_monthly','pagero_pro_monthly','pagero_domain_monthly')
        UNION
        SELECT owner_id FROM partner_payout_requests
      ),
      calltag_referral_stats AS (
        SELECT
          r.referrer_owner_id AS owner_id,
          COUNT(*) AS referred_count,
          SUM(CASE WHEN EXISTS (
            SELECT 1
            FROM billing_subscriptions s
            WHERE s.owner_id = r.referred_owner_id
              AND s.product_code IN ('call_monthly','message_monthly','all_monthly')
              AND s.verification_state = 'verified'
              AND s.status IN ('active','grace','cancelled')
              AND (s.expires_at = '' OR julianday(s.expires_at) > julianday('now'))
          ) THEN 1 ELSE 0 END) AS active_paid_count
        FROM calltag_referrals r
        GROUP BY r.referrer_owner_id
      ),
      pagero_referral_stats AS (
        SELECT
          r.referrer_owner_id AS owner_id,
          COUNT(*) AS referred_count,
          SUM(CASE WHEN EXISTS (
            SELECT 1
            FROM billing_subscriptions s
            WHERE s.owner_id = r.referred_owner_id
              AND s.product_code IN ('pagero_monthly','pagero_pro_monthly','pagero_domain_monthly')
              AND s.verification_state = 'verified'
              AND s.status IN ('active','grace','cancelled')
              AND (s.expires_at = '' OR julianday(s.expires_at) > julianday('now'))
          ) THEN 1 ELSE 0 END) AS active_paid_count
        FROM referrals r
        WHERE EXISTS (
          SELECT 1
          FROM billing_subscriptions s
          WHERE s.owner_id = r.referred_owner_id
            AND s.product_code IN ('pagero_monthly','pagero_pro_monthly','pagero_domain_monthly')
        )
        GROUP BY r.referrer_owner_id
      ),
      calltag_month_commission AS (
        SELECT
          referrer_owner_id AS owner_id,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS confirmed_count,
          COALESCE(SUM(CASE WHEN status = 'confirmed' THEN base_amount_krw ELSE 0 END), 0) AS gross_sales_krw,
          COALESCE(SUM(CASE WHEN status = 'confirmed' THEN commission_amount_krw ELSE 0 END), 0) AS earned_commission_krw,
          COALESCE(SUM(CASE WHEN status = 'estimated' THEN commission_amount_krw ELSE 0 END), 0) AS estimated_commission_krw
        FROM calltag_partner_commissions
        WHERE earned_month = ?
        GROUP BY referrer_owner_id
      ),
      pagero_month_commission AS (
        SELECT
          pc.referrer_owner_id AS owner_id,
          COUNT(CASE WHEN pc.status = 'confirmed' THEN 1 END) AS confirmed_count,
          COALESCE(SUM(CASE WHEN pc.status = 'confirmed' THEN pc.base_amount_krw ELSE 0 END), 0) AS gross_sales_krw,
          COALESCE(SUM(CASE WHEN pc.status = 'confirmed' THEN pc.commission_amount_krw ELSE 0 END), 0) AS earned_commission_krw,
          COALESCE(SUM(CASE WHEN pc.status = 'estimated' THEN pc.commission_amount_krw ELSE 0 END), 0) AS estimated_commission_krw
        FROM partner_commissions pc
        JOIN billing_subscriptions s ON s.id = pc.subscription_id
        WHERE pc.earned_month = ?
          AND s.product_code IN ('pagero_monthly','pagero_pro_monthly','pagero_domain_monthly')
        GROUP BY pc.referrer_owner_id
      ),
      calltag_month_paid AS (
        SELECT
          ps.partner_owner_id AS owner_id,
          COALESCE(SUM(psi.commission_amount_krw), 0) AS paid_amount_krw,
          COUNT(DISTINCT ps.settlement_id) AS settlement_count,
          MAX(ps.paid_at) AS last_paid_at
        FROM partner_settlements ps
        JOIN calltag_partner_settlement_items psi
          ON psi.settlement_id = ps.settlement_id
        WHERE ps.settlement_month = ? AND ps.status = 'paid'
        GROUP BY ps.partner_owner_id
      ),
      pagero_month_paid AS (
        SELECT
          ps.partner_owner_id AS owner_id,
          COALESCE(SUM(psi.commission_amount_krw), 0) AS paid_amount_krw,
          COUNT(DISTINCT ps.settlement_id) AS settlement_count,
          MAX(ps.paid_at) AS last_paid_at
        FROM partner_settlements ps
        JOIN partner_settlement_items psi ON psi.settlement_id = ps.settlement_id
        JOIN partner_commissions pc ON pc.id = psi.commission_id
        JOIN billing_subscriptions s ON s.id = pc.subscription_id
        WHERE ps.settlement_month = ?
          AND ps.status = 'paid'
          AND s.product_code IN ('pagero_monthly','pagero_pro_monthly','pagero_domain_monthly')
        GROUP BY ps.partner_owner_id
      ),
      active_request AS (
        SELECT
          owner_id,
          COUNT(*) AS request_count,
          COALESCE(SUM(amount_krw), 0) AS requested_amount_krw,
          MAX(requested_at) AS last_requested_at
        FROM partner_payout_requests
        WHERE settlement_month = ? AND status IN ('requested','processing','review')
        GROUP BY owner_id
      )
      SELECT
        ids.owner_id,
        p.email,
        p.phone,
        rc.code AS referral_code,
        COALESCE(pp.commission_rate_bps, 2000) AS commission_rate_bps,

        COALESCE(crs.referred_count, 0) AS calltag_referred_count,
        COALESCE(crs.active_paid_count, 0) AS calltag_active_paid_count,
        COALESCE(prs.referred_count, 0) AS pagero_referred_count,
        COALESCE(prs.active_paid_count, 0) AS pagero_active_paid_count,

        COALESCE(cmc.confirmed_count, 0) AS calltag_confirmed_count,
        COALESCE(cmc.gross_sales_krw, 0) AS calltag_gross_sales_krw,
        COALESCE(cmc.earned_commission_krw, 0) AS calltag_earned_commission_krw,
        COALESCE(cmc.estimated_commission_krw, 0) AS calltag_estimated_commission_krw,
        COALESCE(pmc.confirmed_count, 0) AS pagero_confirmed_count,
        COALESCE(pmc.gross_sales_krw, 0) AS pagero_gross_sales_krw,
        COALESCE(pmc.earned_commission_krw, 0) AS pagero_earned_commission_krw,
        COALESCE(pmc.estimated_commission_krw, 0) AS pagero_estimated_commission_krw,

        COALESCE(cmp.paid_amount_krw, 0) AS calltag_paid_amount_krw,
        COALESCE(cmp.settlement_count, 0) AS calltag_settlement_count,
        cmp.last_paid_at AS calltag_last_paid_at,
        COALESCE(pmp.paid_amount_krw, 0) AS pagero_paid_amount_krw,
        COALESCE(pmp.settlement_count, 0) AS pagero_settlement_count,
        pmp.last_paid_at AS pagero_last_paid_at,

        COALESCE(ar.request_count, 0) AS request_count,
        COALESCE(ar.requested_amount_krw, 0) AS requested_amount_krw,
        ar.last_requested_at
      FROM partner_ids ids
      LEFT JOIN calllink_profiles p ON p.owner_id = ids.owner_id
      LEFT JOIN referral_codes rc ON rc.owner_id = ids.owner_id
      LEFT JOIN partner_profiles pp ON pp.owner_id = ids.owner_id
      LEFT JOIN calltag_referral_stats crs ON crs.owner_id = ids.owner_id
      LEFT JOIN pagero_referral_stats prs ON prs.owner_id = ids.owner_id
      LEFT JOIN calltag_month_commission cmc ON cmc.owner_id = ids.owner_id
      LEFT JOIN pagero_month_commission pmc ON pmc.owner_id = ids.owner_id
      LEFT JOIN calltag_month_paid cmp ON cmp.owner_id = ids.owner_id
      LEFT JOIN pagero_month_paid pmp ON pmp.owner_id = ids.owner_id
      LEFT JOIN active_request ar ON ar.owner_id = ids.owner_id
      ORDER BY
        CASE WHEN COALESCE(ar.request_count, 0) > 0 THEN 0 ELSE 1 END ASC,
        datetime(ar.last_requested_at) DESC,
        (
          COALESCE(cmc.earned_commission_krw, 0)
          + COALESCE(pmc.earned_commission_krw, 0)
          - COALESCE(cmp.paid_amount_krw, 0)
          - COALESCE(pmp.paid_amount_krw, 0)
        ) DESC,
        ids.owner_id ASC
      LIMIT 500
    `).bind(month, month, month, month, month).all();

    const partners = (Array.isArray(result?.results) ? result.results : []).map((row) => {
      const calltagEarned = amount(row.calltag_earned_commission_krw);
      const pageroEarned = amount(row.pagero_earned_commission_krw);
      const calltagPaid = Math.min(calltagEarned, amount(row.calltag_paid_amount_krw));
      const pageroPaid = Math.min(pageroEarned, amount(row.pagero_paid_amount_krw));
      const earned = calltagEarned + pageroEarned;
      const paid = calltagPaid + pageroPaid;
      const payoutRequestCount = amount(row.request_count);
      const requestedAmountKrw = amount(row.requested_amount_krw);

      return {
        ownerId: String(row.owner_id || '').slice(0, 120),
        email: maskEmail(row.email),
        phone: maskPhone(row.phone),
        referralCode: String(row.referral_code || '').slice(0, 20),
        commissionRatePercent: Number(row.commission_rate_bps || 2000) === 5000 ? 50 : 20,
        calltagCommissionRatePercent: 20,
        referredCount: amount(row.calltag_referred_count) + amount(row.pagero_referred_count),
        activePaidCount: amount(row.calltag_active_paid_count) + amount(row.pagero_active_paid_count),
        calltag: {
          referredCount: amount(row.calltag_referred_count),
          activePaidCount: amount(row.calltag_active_paid_count),
          confirmedCount: amount(row.calltag_confirmed_count),
          grossSalesKrw: amount(row.calltag_gross_sales_krw),
          earnedCommissionKrw: calltagEarned,
          estimatedCommissionKrw: amount(row.calltag_estimated_commission_krw),
          paidAmountKrw: calltagPaid,
          payableAmountKrw: Math.max(0, calltagEarned - calltagPaid),
          settlementCount: amount(row.calltag_settlement_count),
          lastPaidAt: safeIso(row.calltag_last_paid_at),
        },
        pagero: {
          referredCount: amount(row.pagero_referred_count),
          activePaidCount: amount(row.pagero_active_paid_count),
          confirmedCount: amount(row.pagero_confirmed_count),
          grossSalesKrw: amount(row.pagero_gross_sales_krw),
          earnedCommissionKrw: pageroEarned,
          estimatedCommissionKrw: amount(row.pagero_estimated_commission_krw),
          paidAmountKrw: pageroPaid,
          payableAmountKrw: Math.max(0, pageroEarned - pageroPaid),
          settlementCount: amount(row.pagero_settlement_count),
          lastPaidAt: safeIso(row.pagero_last_paid_at),
        },
        month: {
          confirmedCount: amount(row.calltag_confirmed_count) + amount(row.pagero_confirmed_count),
          grossSalesKrw: amount(row.calltag_gross_sales_krw) + amount(row.pagero_gross_sales_krw),
          earnedCommissionKrw: earned,
          estimatedCommissionKrw:
            amount(row.calltag_estimated_commission_krw) + amount(row.pagero_estimated_commission_krw),
          paidAmountKrw: paid,
          payableAmountKrw: Math.max(0, earned - paid),
          payoutRequestCount,
          requestedAmountKrw,
          lastRequestedAt: safeIso(row.last_requested_at),
          settlementCount: amount(row.calltag_settlement_count) + amount(row.pagero_settlement_count),
          lastPaidAt: latestIso(row.calltag_last_paid_at, row.pagero_last_paid_at),
          status: payoutRequestCount > 0 ? 'requested' : settlementStatus(earned, paid),
        },
      };
    }).filter((row) => row.ownerId);

    const totals = partners.reduce((acc, partner) => {
      acc.partnerCount += 1;
      acc.grossSalesKrw += partner.month.grossSalesKrw;
      acc.earnedCommissionKrw += partner.month.earnedCommissionKrw;
      acc.payableAmountKrw += partner.month.payableAmountKrw;
      acc.paidAmountKrw += partner.month.paidAmountKrw;
      acc.payoutRequestCount += partner.month.payoutRequestCount;
      acc.requestedAmountKrw += partner.month.requestedAmountKrw;
      return acc;
    }, {
      partnerCount: 0,
      grossSalesKrw: 0,
      earnedCommissionKrw: 0,
      payableAmountKrw: 0,
      paidAmountKrw: 0,
      payoutRequestCount: 0,
      requestedAmountKrw: 0,
    });

    await recordAdminAudit(env.DB, request, env, identity, 'partners.read');
    return adminJson(200, {
      ok: true,
      readOnly: !isCalltagFinanceAdmin(identity, env),
      financeWriteEnabled: isCalltagFinanceAdmin(identity, env),
      month,
      totals,
      partners,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

function amount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(parsed))
    : 0;
}

function safeIso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function latestIso(...values) {
  let latest = 0;
  for (const value of values) {
    const parsed = Date.parse(String(value || ''));
    if (Number.isFinite(parsed) && parsed > latest) latest = parsed;
  }
  return latest > 0 ? new Date(latest).toISOString() : '';
}

function settlementStatus(earned, paid) {
  if (!earned) return 'none';
  if (paid >= earned) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
}
