import { handleApiError, jsonResponse, optionsResponse } from '../_shared.js';
import {
  PARTNER_PORTAL_METHODS,
  amount,
  normalizeService,
  partnerPortalContext,
  safeIso,
} from './_portal.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, PARTNER_PORTAL_METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, PARTNER_PORTAL_METHODS);
  }
  try {
    const context = await partnerPortalContext(request, env);
    const service = normalizeService(new URL(request.url).searchParams.get('service') || 'ALL');
    const [requestResult, settlementResult] = await Promise.all([
      context.db.prepare(`
        SELECT request_id, settlement_month, service_scope, amount_krw, status,
               settlement_id, requested_at, processed_at
        FROM partner_payout_requests
        WHERE owner_id = ?
          AND NOT (status = 'paid' AND settlement_id <> '')
          AND (? = 'ALL' OR service_scope = 'ALL' OR service_scope = ?)
        ORDER BY requested_at DESC
        LIMIT 100
      `).bind(context.ownerId, service, service).all(),
      context.db.prepare(`
        SELECT
          ps.settlement_id,
          ps.settlement_month,
          ps.payout_amount_krw,
          ps.status,
          ps.paid_at,
          ps.created_at,
          COALESCE((
            SELECT pr.service_scope
            FROM partner_payout_requests pr
            WHERE pr.settlement_id = ps.settlement_id
              AND pr.owner_id = ps.partner_owner_id
            ORDER BY datetime(pr.processed_at) DESC, datetime(pr.requested_at) DESC
            LIMIT 1
          ), 'ALL') AS service_scope
        FROM partner_settlements ps
        WHERE ps.partner_owner_id = ?
          AND (
            ? = 'ALL'
            OR COALESCE((
              SELECT pr.service_scope
              FROM partner_payout_requests pr
              WHERE pr.settlement_id = ps.settlement_id
                AND pr.owner_id = ps.partner_owner_id
              ORDER BY datetime(pr.processed_at) DESC, datetime(pr.requested_at) DESC
              LIMIT 1
            ), 'ALL') IN ('ALL', ?)
          )
        ORDER BY ps.created_at DESC
        LIMIT 100
      `).bind(context.ownerId, service, service).all(),
    ]);

    const requests = (Array.isArray(requestResult?.results) ? requestResult.results : []).map((row) => ({
      settlementNumber: String(row.request_id || '').slice(0, 120),
      id: String(row.request_id || '').slice(0, 120),
      service: String(row.service_scope || 'ALL'),
      periodLabel: String(row.settlement_month || '').slice(0, 7),
      requestedAt: safeIso(row.requested_at),
      amount: amount(row.amount_krw),
      paidAt: String(row.status || '') === 'paid' ? safeIso(row.processed_at) : '',
      status: requestStatus(row.status),
      _sort: Date.parse(String(row.requested_at || '')) || 0,
    }));
    const settlements = (Array.isArray(settlementResult?.results) ? settlementResult.results : []).map((row) => ({
      settlementNumber: String(row.settlement_id || '').slice(0, 120),
      id: String(row.settlement_id || '').slice(0, 120),
      service: String(row.service_scope || 'ALL'),
      periodLabel: String(row.settlement_month || '').slice(0, 7),
      requestedAt: safeIso(row.created_at),
      amount: amount(row.payout_amount_krw),
      paidAt: safeIso(row.paid_at),
      status: settlementStatus(row.status),
      _sort: Date.parse(String(row.created_at || '')) || 0,
    }));
    const items = [...requests, ...settlements]
      .sort((a, b) => b._sort - a._sort)
      .slice(0, 150)
      .map(({ _sort, ...item }) => item);
    return jsonResponse(request, env, 200, { ok: true, service, items }, PARTNER_PORTAL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, PARTNER_PORTAL_METHODS);
  }
}

function requestStatus(value = '') {
  const status = String(value || '').toLowerCase();
  if (status === 'requested') return 'REQUESTED';
  if (status === 'processing') return 'PROCESSING';
  if (status === 'paid') return 'PAID';
  if (status === 'cancelled') return 'REVERSED';
  return 'HELD';
}

function settlementStatus(value = '') {
  const status = String(value || '').toLowerCase();
  if (status === 'paid') return 'PAID';
  if (status === 'processing') return 'PROCESSING';
  if (status === 'cancelled') return 'REVERSED';
  return 'HELD';
}
