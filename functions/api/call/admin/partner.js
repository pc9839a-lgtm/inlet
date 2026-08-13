import {
  adminErrorResponse,
  adminJson,
  adminOptions,
  maskEmail,
  maskPhone,
  ownerIdInput,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';
import { isCalltagFinanceAdmin } from './_financeSecurity.js';
import { ensureBillingSchema } from '../../billing/_shared.js';
import { ensurePartnerFinanceSchema, normalizeSettlementMonth } from '../../billing/_partnerFinance.js';
import { ensurePartnerPortalSchema } from '../../partner/_portal.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });

  try {
    const identity = await requireCalltagAdmin(request, env);
    const financeWriteEnabled = isCalltagFinanceAdmin(identity, env);
    const url = new URL(request.url);
    const ownerId = ownerIdInput(url.searchParams.get('ownerId') || '');
    const month = normalizeSettlementMonth(url.searchParams.get('month') || '') || new Date().toISOString().slice(0, 7);
    await Promise.all([
      ensureBillingSchema(env.DB),
      ensurePartnerFinanceSchema(env.DB),
      ensurePartnerPortalSchema(env.DB),
    ]);

    const profile = await env.DB.prepare(`
      SELECT
        p.owner_id,
        p.email,
        p.phone,
        rc.code AS referral_code,
        COALESCE(pp.commission_rate_bps, 2000) AS commission_rate_bps,
        COALESCE(pp.status, 'active') AS partner_status
      FROM calllink_profiles p
      LEFT JOIN referral_codes rc ON rc.owner_id = p.owner_id
      LEFT JOIN partner_profiles pp ON pp.owner_id = p.owner_id
      WHERE p.owner_id = ?
      LIMIT 1
    `).bind(ownerId).first();
    if (!profile?.owner_id) {
      return adminJson(404, { ok: false, error: '파트너 회원을 찾을 수 없습니다.', code: 'CALLTAG_ADMIN_PARTNER_NOT_FOUND' });
    }

    const [referralStats, commissionResult, settlementResult, payoutRequestResult, payoutProfile] = await Promise.all([
      env.DB.prepare(`
        SELECT
          COUNT(*) AS referred_count,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM billing_subscriptions s
            WHERE s.owner_id = r.referred_owner_id
              AND s.verification_state = 'verified'
              AND s.status IN ('active','grace','cancelled')
              AND (s.expires_at = '' OR julianday(s.expires_at) > julianday('now'))
          ) THEN 1 ELSE 0 END) AS active_paid_count
        FROM referrals r
        WHERE r.referrer_owner_id = ?
      `).bind(ownerId).first(),
      env.DB.prepare(`
        SELECT
          pc.id,
          pc.referred_owner_id,
          referred.email AS referred_email,
          referred.phone AS referred_phone,
          s.product_code,
          pc.base_amount_krw,
          pc.commission_amount_krw,
          pc.status,
          pc.confirmed_at,
          pc.created_at,
          CASE WHEN EXISTS (
            SELECT 1
            FROM partner_settlement_items psi
            JOIN partner_settlements ps ON ps.settlement_id = psi.settlement_id
            WHERE psi.commission_id = pc.id AND ps.status = 'paid'
          ) THEN 1 ELSE 0 END AS paid
        FROM partner_commissions pc
        LEFT JOIN calllink_profiles referred ON referred.owner_id = pc.referred_owner_id
        LEFT JOIN billing_subscriptions s ON s.id = pc.subscription_id
        WHERE pc.referrer_owner_id = ? AND pc.earned_month = ?
        ORDER BY pc.created_at DESC, pc.id DESC
        LIMIT 300
      `).bind(ownerId, month).all(),
      env.DB.prepare(`
        SELECT
          settlement_month,
          COUNT(*) AS settlement_count,
          COALESCE(SUM(payout_amount_krw), 0) AS paid_amount_krw,
          COALESCE(SUM(commission_count), 0) AS commission_count,
          MAX(paid_at) AS last_paid_at
        FROM partner_settlements
        WHERE partner_owner_id = ? AND status = 'paid'
        GROUP BY settlement_month
        ORDER BY settlement_month DESC
        LIMIT 12
      `).bind(ownerId).all(),
      env.DB.prepare(`
        SELECT request_id, settlement_month, service_scope, amount_krw, status,
               settlement_id, requested_at, processed_at
        FROM partner_payout_requests
        WHERE owner_id = ? AND settlement_month = ?
        ORDER BY datetime(requested_at) DESC, request_id DESC
        LIMIT 20
      `).bind(ownerId, month).all(),
      env.DB.prepare(`
        SELECT payout_type, account_holder, bank_name, account_number_last4,
               settlement_email, phone, business_name, business_number_last4,
               tax_email, updated_at
        FROM partner_payout_profiles
        WHERE owner_id = ?
        LIMIT 1
      `).bind(ownerId).first(),
    ]);

    const commissions = (Array.isArray(commissionResult?.results) ? commissionResult.results : []).map((row) => {
      const base = amount(row.base_amount_krw);
      const commission = amount(row.commission_amount_krw);
      return {
        id: Math.max(0, Math.trunc(Number(row.id || 0))),
        referredOwnerId: String(row.referred_owner_id || '').slice(0, 120),
        referredEmail: maskEmail(row.referred_email),
        referredPhone: maskPhone(row.referred_phone),
        productCode: String(row.product_code || '').slice(0, 80),
        baseAmountKrw: base,
        commissionAmountKrw: commission,
        effectiveRatePercent: base > 0 ? Math.round((commission / base) * 100) : 0,
        status: String(row.status || '').slice(0, 24),
        paid: Number(row.paid || 0) === 1,
        confirmedAt: safeIso(row.confirmed_at),
        createdAt: safeIso(row.created_at),
      };
    });

    const confirmed = commissions.filter((item) => item.status === 'confirmed');
    const earnedCommissionKrw = confirmed.reduce((sum, item) => sum + item.commissionAmountKrw, 0);
    const grossSalesKrw = confirmed.reduce((sum, item) => sum + item.baseAmountKrw, 0);
    const paidAmountKrw = confirmed.filter((item) => item.paid).reduce((sum, item) => sum + item.commissionAmountKrw, 0);

    const settlements = (Array.isArray(settlementResult?.results) ? settlementResult.results : []).map((row) => ({
      month: String(row.settlement_month || '').slice(0, 7),
      settlementCount: amount(row.settlement_count),
      commissionCount: amount(row.commission_count),
      paidAmountKrw: amount(row.paid_amount_krw),
      lastPaidAt: safeIso(row.last_paid_at),
    }));

    const payoutRequests = (Array.isArray(payoutRequestResult?.results) ? payoutRequestResult.results : []).map((row) => ({
      requestId: String(row.request_id || '').slice(0, 120),
      month: String(row.settlement_month || '').slice(0, 7),
      service: safeService(row.service_scope),
      amountKrw: amount(row.amount_krw),
      status: safeRequestStatus(row.status),
      settlementId: String(row.settlement_id || '').slice(0, 120),
      requestedAt: safeIso(row.requested_at),
      processedAt: safeIso(row.processed_at),
    }));
    const activeRequests = payoutRequests.filter((item) => ['requested', 'processing', 'review'].includes(item.status));

    const payoutProfileDto = payoutProfile
      ? financeWriteEnabled
        ? {
            configured: true,
            payoutType: safePayoutType(payoutProfile.payout_type),
            accountHolder: String(payoutProfile.account_holder || '').trim().slice(0, 80),
            bankName: String(payoutProfile.bank_name || '').trim().slice(0, 60),
            accountNumberMasked: maskLast4(payoutProfile.account_number_last4, '****-****-'),
            settlementEmail: maskEmail(payoutProfile.settlement_email),
            phone: maskPhone(payoutProfile.phone),
            businessName: String(payoutProfile.business_name || '').trim().slice(0, 120),
            businessNumberMasked: maskLast4(payoutProfile.business_number_last4, '***-**-'),
            taxEmail: maskEmail(payoutProfile.tax_email),
            updatedAt: safeIso(payoutProfile.updated_at),
          }
        : { configured: true }
      : { configured: false };

    await recordAdminAudit(env.DB, request, env, identity, 'partner.read', ownerId);
    return adminJson(200, {
      ok: true,
      financeWriteEnabled,
      partner: {
        ownerId,
        email: maskEmail(profile.email),
        phone: maskPhone(profile.phone),
        referralCode: String(profile.referral_code || '').slice(0, 20),
        commissionRatePercent: Number(profile.commission_rate_bps || 2000) === 5000 ? 50 : 20,
        status: String(profile.partner_status || 'active').slice(0, 20),
        referredCount: amount(referralStats?.referred_count),
        activePaidCount: amount(referralStats?.active_paid_count),
      },
      month: {
        value: month,
        grossSalesKrw,
        earnedCommissionKrw,
        paidAmountKrw,
        payableAmountKrw: Math.max(0, earnedCommissionKrw - paidAmountKrw),
        payoutRequestCount: activeRequests.length,
        requestedAmountKrw: activeRequests.reduce((sum, item) => sum + item.amountKrw, 0),
      },
      payoutRequests,
      payoutProfile: payoutProfileDto,
      commissions,
      settlements,
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

function safeService(value) {
  const service = String(value || '').trim().toUpperCase();
  return ['ALL', 'CALLTAG', 'PAGERO'].includes(service) ? service : 'ALL';
}

function safeRequestStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return ['requested', 'processing', 'paid', 'cancelled', 'review'].includes(status) ? status : 'review';
}

function safePayoutType(value) {
  const type = String(value || '').trim().toUpperCase();
  return ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATION'].includes(type) ? type : 'INDIVIDUAL';
}

function maskLast4(value, prefix) {
  const last4 = String(value || '').replace(/\D/g, '').slice(-4);
  return last4 ? `${prefix}${last4}` : '';
}
