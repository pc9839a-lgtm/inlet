import { handleApiError, jsonResponse, optionsResponse } from '../_shared.js';
import {
  PARTNER_PORTAL_METHODS,
  amount,
  commissionRatePercent,
  maskName,
  normalizeService,
  partnerPortalContext,
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
    const rate = await commissionRatePercent(context.db, context.ownerId);
    const result = await context.db.prepare(`
      SELECT
        pc.id,
        pc.referred_owner_id,
        pc.base_amount_krw,
        pc.commission_amount_krw,
        pc.status,
        pc.confirmed_at,
        pc.created_at,
        s.product_code,
        p.name AS referred_name,
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
      LIMIT 500
    `).bind(context.ownerId).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const items = rows.map((row) => {
      const base = amount(row.base_amount_krw);
      const commission = amount(row.commission_amount_krw);
      return {
        id: amount(row.id),
        occurredAt: safeIso(row.created_at),
        confirmedAt: safeIso(row.confirmed_at),
        service: serviceForProduct(row.product_code),
        memberNameMasked: maskName(row.referred_name) || '추천 회원',
        productName: productLabel(row.product_code),
        paymentAmount: base,
        recognizedRevenue: base,
        partnerRate: base > 0 ? Math.round((commission / base) * 100) : rate,
        partnerEarning: commission,
        status: Number(row.paid || 0) === 1
          ? 'PAID'
          : String(row.status || '').toLowerCase() === 'confirmed'
            ? 'CONFIRMED'
            : String(row.status || '').toLowerCase() === 'cancelled'
              ? 'REVERSED'
              : 'ESTIMATED',
      };
    });
    return jsonResponse(request, env, 200, { ok: true, service, items }, PARTNER_PORTAL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_PORTAL_METHODS);
  }
}
