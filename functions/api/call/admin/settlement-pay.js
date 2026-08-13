import {
  adminErrorResponse,
  adminJson,
  ownerIdInput,
  recordAdminAudit,
} from './_security.js';
import {
  financeOptions,
  methodNotAllowed,
  readJsonBody,
  requireCalltagFinanceAdmin,
} from './_financeSecurity.js';
import { ensureBillingSchema } from '../../billing/_shared.js';
import {
  createSettlementId,
  ensurePartnerFinanceSchema,
  normalizeSettlementMonth,
} from '../../billing/_partnerFinance.js';
import { ensurePartnerPortalSchema } from '../../partner/_portal.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return financeOptions();
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const identity = await requireCalltagFinanceAdmin(request, env, 'partner.settlement.pay');
    const body = await readJsonBody(request);
    const ownerId = ownerIdInput(body.ownerId || '');
    const requestId = payoutRequestIdInput(body.requestId || '');
    const expectedAmountKrw = positiveInt(body.expectedAmountKrw);
    if (!expectedAmountKrw) {
      return adminJson(400, { ok: false, error: '지급요청 금액을 확인해주세요.', code: 'CALLTAG_ADMIN_SETTLEMENT_AMOUNT_INVALID' });
    }

    await Promise.all([
      ensureBillingSchema(env.DB),
      ensurePartnerFinanceSchema(env.DB),
      ensurePartnerPortalSchema(env.DB),
    ]);

    const payoutRequest = await env.DB.prepare(`
      SELECT request_id, owner_id, settlement_month, service_scope, amount_krw,
             status, settlement_id, requested_at
      FROM partner_payout_requests
      WHERE request_id = ? AND owner_id = ?
      LIMIT 1
    `).bind(requestId, ownerId).first();
    if (!payoutRequest?.request_id) {
      return adminJson(404, { ok: false, error: '지급요청을 찾을 수 없습니다.', code: 'CALLTAG_ADMIN_PAYOUT_REQUEST_NOT_FOUND' });
    }
    if (String(payoutRequest.status || '') !== 'requested') {
      return adminJson(409, {
        ok: false,
        error: '이미 처리 중이거나 완료된 지급요청입니다.',
        code: 'CALLTAG_ADMIN_PAYOUT_REQUEST_NOT_REQUESTED',
        requestStatus: String(payoutRequest.status || '').slice(0, 24),
      });
    }

    const month = normalizeSettlementMonth(payoutRequest.settlement_month || '');
    if (!month) {
      return adminJson(409, { ok: false, error: '지급요청의 정산 월을 확인할 수 없습니다.', code: 'CALLTAG_ADMIN_SETTLEMENT_MONTH_INVALID' });
    }
    const bodyMonth = String(body.month || '').trim();
    if (bodyMonth && normalizeSettlementMonth(bodyMonth) !== month) {
      return adminJson(409, { ok: false, error: '지급요청의 정산 월이 변경되었습니다. 새로고침해주세요.', code: 'CALLTAG_ADMIN_PAYOUT_REQUEST_MONTH_CHANGED' });
    }

    const requestedAmountKrw = positiveInt(payoutRequest.amount_krw);
    if (!requestedAmountKrw || requestedAmountKrw !== expectedAmountKrw) {
      return adminJson(409, {
        ok: false,
        error: '지급요청 금액이 변경되었습니다. 새로고침 후 다시 확인해주세요.',
        code: 'CALLTAG_ADMIN_PAYOUT_REQUEST_AMOUNT_CHANGED',
        currentAmountKrw: requestedAmountKrw,
      });
    }

    const service = normalizeService(payoutRequest.service_scope);
    const serviceFilter = serviceSql('s', service);
    const payable = await currentPayable(
      env.DB,
      ownerId,
      month,
      serviceFilter,
      payoutRequest.requested_at,
    );
    if (!payable.count || !payable.amountKrw) {
      return adminJson(409, { ok: false, error: '지급할 확정 정산금이 없습니다.', code: 'CALLTAG_ADMIN_SETTLEMENT_NOTHING_TO_PAY' });
    }
    if (payable.amountKrw !== requestedAmountKrw) {
      return adminJson(409, {
        ok: false,
        error: '지급요청 이후 정산 대상 금액이 변경되었습니다. 내역을 검토해주세요.',
        code: 'CALLTAG_ADMIN_SETTLEMENT_AMOUNT_CHANGED',
        requestedAmountKrw,
        currentAmountKrw: payable.amountKrw,
      });
    }

    const settlementId = createSettlementId();
    const batch = await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO partner_settlements (
          settlement_id, partner_owner_id, settlement_month, commission_count,
          gross_sales_krw, payout_amount_krw, status, paid_at, paid_by_owner_id,
          created_at, updated_at
        )
        SELECT ?, pr.owner_id, pr.settlement_month, 0, 0, pr.amount_krw,
               'processing', '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM partner_payout_requests pr
        WHERE pr.request_id = ?
          AND pr.owner_id = ?
          AND pr.status = 'requested'
          AND pr.amount_krw = ?
          AND pr.settlement_month = ?
          AND ? = COALESCE((
            SELECT SUM(pc.commission_amount_krw)
            FROM partner_commissions pc
            LEFT JOIN billing_subscriptions s ON s.id = pc.subscription_id
            WHERE pc.referrer_owner_id = pr.owner_id
              AND pc.earned_month = pr.settlement_month
              AND pc.status = 'confirmed'
              AND ${serviceFilter}
              AND datetime(COALESCE(NULLIF(pc.confirmed_at, ''), pc.created_at)) <= datetime(pr.requested_at)
              AND NOT EXISTS (
                SELECT 1
                FROM partner_settlement_items psi
                JOIN partner_settlements ps ON ps.settlement_id = psi.settlement_id
                WHERE psi.commission_id = pc.id
                  AND ps.status IN ('processing','paid','review')
              )
          ), 0)
      `).bind(
        settlementId,
        identity.ownerId,
        requestId,
        ownerId,
        requestedAmountKrw,
        month,
        requestedAmountKrw,
      ),
      env.DB.prepare(`
        INSERT OR IGNORE INTO partner_settlement_items (
          settlement_id, commission_id, base_amount_krw, commission_amount_krw, created_at
        )
        SELECT ?, pc.id, pc.base_amount_krw, pc.commission_amount_krw, CURRENT_TIMESTAMP
        FROM partner_commissions pc
        LEFT JOIN billing_subscriptions s ON s.id = pc.subscription_id
        JOIN partner_payout_requests pr
          ON pr.request_id = ?
         AND pr.owner_id = pc.referrer_owner_id
         AND pr.settlement_month = pc.earned_month
         AND pr.status = 'requested'
        WHERE pc.referrer_owner_id = ?
          AND pc.earned_month = ?
          AND pc.status = 'confirmed'
          AND ${serviceFilter}
          AND datetime(COALESCE(NULLIF(pc.confirmed_at, ''), pc.created_at)) <= datetime(pr.requested_at)
          AND EXISTS (
            SELECT 1 FROM partner_settlements ps
            WHERE ps.settlement_id = ? AND ps.status = 'processing'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM partner_settlement_items psi
            JOIN partner_settlements ps2 ON ps2.settlement_id = psi.settlement_id
            WHERE psi.commission_id = pc.id
              AND ps2.status IN ('processing','paid','review')
          )
      `).bind(settlementId, requestId, ownerId, month, settlementId),
      env.DB.prepare(`
        UPDATE partner_settlements
        SET
          commission_count = (SELECT COUNT(*) FROM partner_settlement_items WHERE settlement_id = ?),
          gross_sales_krw = COALESCE((SELECT SUM(base_amount_krw) FROM partner_settlement_items WHERE settlement_id = ?), 0),
          payout_amount_krw = COALESCE((SELECT SUM(commission_amount_krw) FROM partner_settlement_items WHERE settlement_id = ?), 0),
          status = CASE
            WHEN COALESCE((SELECT SUM(commission_amount_krw) FROM partner_settlement_items WHERE settlement_id = ?), 0) = ?
             AND (SELECT COUNT(*) FROM partner_settlement_items WHERE settlement_id = ?) > 0
            THEN 'paid' ELSE 'review' END,
          paid_at = CASE
            WHEN COALESCE((SELECT SUM(commission_amount_krw) FROM partner_settlement_items WHERE settlement_id = ?), 0) = ?
            THEN CURRENT_TIMESTAMP ELSE '' END,
          updated_at = CURRENT_TIMESTAMP
        WHERE settlement_id = ? AND status = 'processing'
      `).bind(
        settlementId,
        settlementId,
        settlementId,
        settlementId,
        requestedAmountKrw,
        settlementId,
        settlementId,
        requestedAmountKrw,
        settlementId,
      ),
      env.DB.prepare(`
        UPDATE partner_payout_requests
        SET
          status = CASE
            WHEN EXISTS (SELECT 1 FROM partner_settlements ps WHERE ps.settlement_id = ? AND ps.status = 'paid')
            THEN 'paid' ELSE 'review' END,
          settlement_id = ?,
          processed_at = CASE
            WHEN EXISTS (SELECT 1 FROM partner_settlements ps WHERE ps.settlement_id = ? AND ps.status = 'paid')
            THEN CURRENT_TIMESTAMP ELSE '' END,
          updated_at = CURRENT_TIMESTAMP
        WHERE request_id = ?
          AND owner_id = ?
          AND status = 'requested'
          AND EXISTS (SELECT 1 FROM partner_settlements ps WHERE ps.settlement_id = ?)
      `).bind(settlementId, settlementId, settlementId, requestId, ownerId, settlementId),
      env.DB.prepare(`
        INSERT INTO partner_finance_audit (
          actor_owner_id, target_owner_id, action, settlement_month, amount_krw,
          old_rate_bps, new_rate_bps, settlement_id, created_at
        )
        SELECT ?, ?, 'partner.settlement.pay', ?, payout_amount_krw, 0, 0, settlement_id, CURRENT_TIMESTAMP
        FROM partner_settlements
        WHERE settlement_id = ? AND status = 'paid'
      `).bind(identity.ownerId, ownerId, month, settlementId),
    ]);

    const inserted = Number(batch?.[0]?.meta?.changes ?? batch?.[0]?.changes ?? 0) > 0;
    if (!inserted) {
      return adminJson(409, {
        ok: false,
        error: '지급요청 또는 정산금이 변경되었습니다. 새로고침 후 다시 확인해주세요.',
        code: 'CALLTAG_ADMIN_SETTLEMENT_AMOUNT_CHANGED',
      });
    }

    const [settlement, processedRequest] = await Promise.all([
      env.DB.prepare(`
        SELECT settlement_id, settlement_month, commission_count, gross_sales_krw,
               payout_amount_krw, status, paid_at
        FROM partner_settlements
        WHERE settlement_id = ?
        LIMIT 1
      `).bind(settlementId).first(),
      env.DB.prepare(`
        SELECT request_id, status, settlement_id, processed_at
        FROM partner_payout_requests
        WHERE request_id = ? AND owner_id = ?
        LIMIT 1
      `).bind(requestId, ownerId).first(),
    ]);

    if (
      settlement?.status !== 'paid'
      || Number(settlement?.payout_amount_krw || 0) !== requestedAmountKrw
      || processedRequest?.status !== 'paid'
      || String(processedRequest?.settlement_id || '') !== settlementId
    ) {
      return adminJson(409, {
        ok: false,
        error: '정산 원장 검증이 필요합니다. 지급완료로 처리하지 않았습니다.',
        code: 'CALLTAG_ADMIN_SETTLEMENT_REVIEW_REQUIRED',
        requestId,
        settlementId,
      });
    }

    await recordAdminAudit(env.DB, request, env, identity, 'partner.settlement.pay', ownerId);
    return adminJson(200, {
      ok: true,
      request: {
        requestId,
        service,
        status: 'paid',
        processedAt: safeIso(processedRequest.processed_at),
      },
      settlement: {
        settlementId: String(settlement.settlement_id || '').slice(0, 120),
        partnerOwnerId: ownerId,
        month: String(settlement.settlement_month || '').slice(0, 7),
        commissionCount: positiveInt(settlement.commission_count),
        grossSalesKrw: positiveInt(settlement.gross_sales_krw),
        paidAmountKrw: positiveInt(settlement.payout_amount_krw),
        status: 'paid',
        paidAt: safeIso(settlement.paid_at),
      },
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

async function currentPayable(db, ownerId, month, serviceFilter, requestedAt) {
  const row = await db.prepare(`
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(pc.commission_amount_krw), 0) AS amount_krw
    FROM partner_commissions pc
    LEFT JOIN billing_subscriptions s ON s.id = pc.subscription_id
    WHERE pc.referrer_owner_id = ?
      AND pc.earned_month = ?
      AND pc.status = 'confirmed'
      AND ${serviceFilter}
      AND datetime(COALESCE(NULLIF(pc.confirmed_at, ''), pc.created_at)) <= datetime(?)
      AND NOT EXISTS (
        SELECT 1
        FROM partner_settlement_items psi
        JOIN partner_settlements ps ON ps.settlement_id = psi.settlement_id
        WHERE psi.commission_id = pc.id
          AND ps.status IN ('processing','paid','review')
      )
  `).bind(ownerId, month, requestedAt).first();
  return { count: positiveInt(row?.count), amountKrw: positiveInt(row?.amount_krw) };
}

function serviceSql(alias, service) {
  if (service === 'PAGERO') return `${alias}.product_code IN ('pagero_monthly','pagero_pro_monthly','pagero_domain_monthly')`;
  if (service === 'CALLTAG') return `${alias}.product_code IN ('call_monthly','message_monthly','all_monthly')`;
  return '1=1';
}

function normalizeService(value) {
  const service = String(value || '').trim().toUpperCase();
  return ['ALL', 'CALLTAG', 'PAGERO'].includes(service) ? service : 'ALL';
}

function payoutRequestIdInput(value) {
  const requestId = String(value || '').trim();
  if (!/^ptr_[a-z0-9]+_[a-f0-9]{20}$/i.test(requestId)) {
    const error = new Error('지급요청 식별자가 올바르지 않습니다.');
    error.status = 400;
    error.details = { code: 'CALLTAG_ADMIN_PAYOUT_REQUEST_ID_INVALID' };
    throw error;
  }
  return requestId;
}

function positiveInt(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(parsed)) : 0;
}

function safeIso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}
