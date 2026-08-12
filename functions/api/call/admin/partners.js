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

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });

  try {
    const identity = await requireCalltagAdmin(request, env);
    const month = normalizeSettlementMonth(new URL(request.url).searchParams.get('month') || '') || new Date().toISOString().slice(0, 7);
    await ensureBillingSchema(env.DB);
    await ensurePartnerFinanceSchema(env.DB);

    const result = await env.DB.prepare(`
      WITH partner_ids AS (
        SELECT owner_id FROM partner_profiles
        UNION
        SELECT referrer_owner_id AS owner_id FROM referrals
        UNION
        SELECT referrer_owner_id AS owner_id FROM partner_commissions
      ),
      referral_stats AS (
        SELECT
          r.referrer_owner_id AS owner_id,
          COUNT(*) AS referred_count,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM billing_subscriptions s
            WHERE s.owner_id = r.referred_owner_id
              AND s.verification_state = 'verified'
              AND s.status IN ('active','grace','cancelled')
              AND (s.expires_at = '' OR julianday(s.expires_at) > julianday('now'))
          ) THEN 1 ELSE 0 END) AS active_paid_count
        FROM referrals r
        GROUP BY r.referrer_owner_id
      ),
      month_commission AS (
        SELECT
          referrer_owner_id AS owner_id,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS confirmed_count,
          COALESCE(SUM(CASE WHEN status = 'confirmed' THEN base_amount_krw ELSE 0 END), 0) AS gross_sales_krw,
          COALESCE(SUM(CASE WHEN status = 'confirmed' THEN commission_amount_krw ELSE 0 END), 0) AS earned_commission_krw,
          COALESCE(SUM(CASE WHEN status = 'estimated' THEN commission_amount_krw ELSE 0 END), 0) AS estimated_commission_krw
        FROM partner_commissions
        WHERE earned_month = ?
        GROUP BY referrer_owner_id
      ),
      month_paid AS (
        SELECT
          ps.partner_owner_id AS owner_id,
          COALESCE(SUM(psi.commission_amount_krw), 0) AS paid_amount_krw,
          COUNT(DISTINCT ps.settlement_id) AS settlement_count,
          MAX(ps.paid_at) AS last_paid_at
        FROM partner_settlements ps
        JOIN partner_settlement_items psi ON psi.settlement_id = ps.settlement_id
        WHERE ps.settlement_month = ? AND ps.status = 'paid'
        GROUP BY ps.partner_owner_id
      )
      SELECT
        ids.owner_id,
        p.email,
        p.phone,
        rc.code AS referral_code,
        COALESCE(pp.commission_rate_bps, 2000) AS commission_rate_bps,
        COALESCE(rs.referred_count, 0) AS referred_count,
        COALESCE(rs.active_paid_count, 0) AS active_paid_count,
        COALESCE(mc.confirmed_count, 0) AS confirmed_count,
        COALESCE(mc.gross_sales_krw, 0) AS gross_sales_krw,
        COALESCE(mc.earned_commission_krw, 0) AS earned_commission_krw,
        COALESCE(mc.estimated_commission_krw, 0) AS estimated_commission_krw,
        COALESCE(mp.paid_amount_krw, 0) AS paid_amount_krw,
        COALESCE(mp.settlement_count, 0) AS settlement_count,
        mp.last_paid_at
      FROM partner_ids ids
      LEFT JOIN calllink_profiles p ON p.owner_id = ids.owner_id
      LEFT JOIN referral_codes rc ON rc.owner_id = ids.owner_id
      LEFT JOIN partner_profiles pp ON pp.owner_id = ids.owner_id
      LEFT JOIN referral_stats rs ON rs.owner_id = ids.owner_id
      LEFT JOIN month_commission mc ON mc.owner_id = ids.owner_id
      LEFT JOIN month_paid mp ON mp.owner_id = ids.owner_id
      ORDER BY
        (COALESCE(mc.earned_commission_krw, 0) - COALESCE(mp.paid_amount_krw, 0)) DESC,
        COALESCE(mc.earned_commission_krw, 0) DESC,
        ids.owner_id ASC
      LIMIT 500
    `).bind(month, month).all();

    const partners = (Array.isArray(result?.results) ? result.results : []).map((row) => {
      const earned = amount(row.earned_commission_krw);
      const paid = Math.min(earned, amount(row.paid_amount_krw));
      const payable = Math.max(0, earned - paid);
      return {
        ownerId: String(row.owner_id || '').slice(0, 120),
        email: maskEmail(row.email),
        phone: maskPhone(row.phone),
        referralCode: String(row.referral_code || '').slice(0, 20),
        commissionRatePercent: Number(row.commission_rate_bps || 2000) === 5000 ? 50 : 20,
        referredCount: amount(row.referred_count),
        activePaidCount: amount(row.active_paid_count),
        month: {
          confirmedCount: amount(row.confirmed_count),
          grossSalesKrw: amount(row.gross_sales_krw),
          earnedCommissionKrw: earned,
          estimatedCommissionKrw: amount(row.estimated_commission_krw),
          paidAmountKrw: paid,
          payableAmountKrw: payable,
          settlementCount: amount(row.settlement_count),
          lastPaidAt: safeIso(row.last_paid_at),
          status: settlementStatus(earned, paid),
        },
      };
    }).filter((row) => row.ownerId);

    const totals = partners.reduce((acc, partner) => {
      acc.partnerCount += 1;
      acc.grossSalesKrw += partner.month.grossSalesKrw;
      acc.earnedCommissionKrw += partner.month.earnedCommissionKrw;
      acc.payableAmountKrw += partner.month.payableAmountKrw;
      acc.paidAmountKrw += partner.month.paidAmountKrw;
      return acc;
    }, { partnerCount: 0, grossSalesKrw: 0, earnedCommissionKrw: 0, payableAmountKrw: 0, paidAmountKrw: 0 });

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
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(parsed)) : 0;
}

function safeIso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function settlementStatus(earned, paid) {
  if (!earned) return 'none';
  if (paid >= earned) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
}
