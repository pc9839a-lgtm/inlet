import { handleApiError, jsonResponse, optionsResponse } from '../_shared.js';
import {
  PARTNER_PORTAL_METHODS,
  amount,
  currentMonth,
  maskEmail,
  maskName,
  normalizeService,
  partnerPortalContext,
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
    const month = currentMonth();

    const rows = service === 'CALLTAG'
      ? await calltagRows(context, month)
      : service === 'PAGERO'
        ? await pageroRows(context, month)
        : [
            ...(await calltagRows(context, month)),
            ...(await pageroRows(context, month)),
          ].sort((a, b) => (Date.parse(String(b.applied_at || '')) || 0) - (Date.parse(String(a.applied_at || '')) || 0))
            .slice(0, 300);

    const items = rows.map((row) => ({
      service: row.product_code ? serviceForProduct(row.product_code) : String(row.service_scope || service),
      nameMasked: maskName(row.name) || '추천 회원',
      emailMasked: maskEmail(row.email),
      joinedAt: safeIso(row.applied_at),
      trialStatus: trialState(row.first_paid_at, row.trial_ends_at),
      firstPaidAt: safeIso(row.first_paid_at),
      subscriptionStatus: subscriptionState(row.subscription_status),
      recognizedAmountThisMonth: amount(row.recognized_amount),
    }));

    return jsonResponse(request, env, 200, { ok: true, service, items }, PARTNER_PORTAL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_PORTAL_METHODS);
  }
}

async function calltagRows(context, month) {
  const result = await context.db.prepare(`
    SELECT
      r.referred_owner_id,
      r.applied_at,
      r.first_paid_at,
      p.name,
      p.email,
      ba.trial_ends_at,
      'CALLTAG' AS service_scope,
      (
        SELECT s.product_code
        FROM billing_subscriptions s
        WHERE s.owner_id = r.referred_owner_id
          AND s.product_code IN ('call_monthly','message_monthly','all_monthly')
        ORDER BY s.updated_at DESC, s.id DESC
        LIMIT 1
      ) AS product_code,
      (
        SELECT s.status
        FROM billing_subscriptions s
        WHERE s.owner_id = r.referred_owner_id
          AND s.product_code IN ('call_monthly','message_monthly','all_monthly')
        ORDER BY s.updated_at DESC, s.id DESC
        LIMIT 1
      ) AS subscription_status,
      (
        SELECT COALESCE(SUM(pc.base_amount_krw), 0)
        FROM calltag_partner_commissions pc
        WHERE pc.referrer_owner_id = ?
          AND pc.referred_owner_id = r.referred_owner_id
          AND pc.earned_month = ?
          AND pc.status IN ('estimated','confirmed')
      ) AS recognized_amount
    FROM calltag_referrals r
    LEFT JOIN calllink_profiles p ON p.owner_id = r.referred_owner_id
    LEFT JOIN billing_accounts ba ON ba.owner_id = r.referred_owner_id
    WHERE r.referrer_owner_id = ?
    ORDER BY r.applied_at DESC, r.id DESC
    LIMIT 300
  `).bind(context.ownerId, month, context.ownerId).all();
  return Array.isArray(result?.results) ? result.results : [];
}

async function pageroRows(context, month) {
  const condition = serviceCondition('s', 'PAGERO');
  const commissionCondition = serviceCondition('cs', 'PAGERO');
  const result = await context.db.prepare(`
    SELECT
      r.referred_owner_id,
      r.applied_at,
      r.first_paid_at,
      p.name,
      p.email,
      ba.trial_ends_at,
      'PAGERO' AS service_scope,
      (
        SELECT s.product_code
        FROM billing_subscriptions s
        WHERE s.owner_id = r.referred_owner_id AND ${condition}
        ORDER BY s.updated_at DESC, s.id DESC
        LIMIT 1
      ) AS product_code,
      (
        SELECT s.status
        FROM billing_subscriptions s
        WHERE s.owner_id = r.referred_owner_id AND ${condition}
        ORDER BY s.updated_at DESC, s.id DESC
        LIMIT 1
      ) AS subscription_status,
      (
        SELECT COALESCE(SUM(pc.base_amount_krw), 0)
        FROM partner_commissions pc
        LEFT JOIN billing_subscriptions cs ON cs.id = pc.subscription_id
        WHERE pc.referrer_owner_id = ?
          AND pc.referred_owner_id = r.referred_owner_id
          AND pc.earned_month = ?
          AND pc.status IN ('estimated','confirmed')
          AND ${commissionCondition}
      ) AS recognized_amount
    FROM referrals r
    LEFT JOIN calllink_profiles p ON p.owner_id = r.referred_owner_id
    LEFT JOIN billing_accounts ba ON ba.owner_id = r.referred_owner_id
    WHERE r.referrer_owner_id = ?
      AND EXISTS (
        SELECT 1 FROM billing_subscriptions s
        WHERE s.owner_id = r.referred_owner_id AND ${condition}
      )
    ORDER BY r.applied_at DESC, r.id DESC
    LIMIT 300
  `).bind(context.ownerId, month, context.ownerId).all();
  return Array.isArray(result?.results) ? result.results : [];
}

function trialState(firstPaidAt, trialEndsAt) {
  if (String(firstPaidAt || '').trim()) return 'EXPIRED';
  const end = Date.parse(String(trialEndsAt || ''));
  return Number.isFinite(end) && end > Date.now() ? 'TRIAL' : 'EXPIRED';
}

function subscriptionState(value = '') {
  const status = String(value || '').trim().toLowerCase();
  if (['active', 'grace'].includes(status)) return 'ACTIVE';
  if (status === 'cancelled') return 'CANCELED';
  if (status === 'expired') return 'EXPIRED';
  if (status === 'refunded') return 'REVERSED';
  return status ? status.toUpperCase() : 'TRIAL';
}
