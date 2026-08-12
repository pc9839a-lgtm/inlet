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

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return financeOptions();
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const identity = await requireCalltagFinanceAdmin(request, env, 'partner.settlement.pay');
    const body = await readJsonBody(request);
    const ownerId = ownerIdInput(body.ownerId || '');
    const month = normalizeSettlementMonth(body.month || '');
    const expectedAmountKrw = positiveInt(body.expectedAmountKrw);
    if (!month) {
      return adminJson(400, { ok: false, error: '정산 월이 올바르지 않습니다.', code: 'CALLTAG_ADMIN_SETTLEMENT_MONTH_INVALID' });
    }
    if (!expectedAmountKrw) {
      return adminJson(400, { ok: false, error: '정산 예정 금액을 확인해주세요.', code: 'CALLTAG_ADMIN_SETTLEMENT_AMOUNT_INVALID' });
    }

    await ensureBillingSchema(env.DB);
    await ensurePartnerFinanceSchema(env.DB);

    const payable = await currentPayable(env.DB, ownerId, month);
    if (!payable.count || !payable.amountKrw) {
      return adminJson(409, { ok: false, error: '지급할 확정 정산금이 없습니다.', code: 'CALLTAG_ADMIN_SETTLEMENT_NOTHING_TO_PAY' });
    }
    if (payable.amountKrw !== expectedAmountKrw) {
      return adminJson(409, {
        ok: false,
        error: '정산금이 변경되었습니다. 새로고침 후 다시 확인해주세요.',
        code: 'CALLTAG_ADMIN_SETTLEMENT_AMOUNT_CHANGED',
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
        SELECT ?, ?, ?, 0, 0, ?, 'processing', '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        WHERE ? = COALESCE((
          SELECT SUM(pc.commission_amount_krw)
          FROM partner_commissions pc
          WHERE pc.referrer_owner_id = ?
            AND pc.earned_month = ?
            AND pc.status = 'confirmed'
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
        ownerId,
        month,
        expectedAmountKrw,
        identity.ownerId,
        expectedAmountKrw,
        ownerId,
        month,
      ),
      env.DB.prepare(`
        INSERT OR IGNORE INTO partner_settlement_items (
          settlement_id, commission_id, base_amount_krw, commission_amount_krw, created_at
        )
        SELECT ?, pc.id, pc.base_amount_krw, pc.commission_amount_krw, CURRENT_TIMESTAMP
        FROM partner_commissions pc
        WHERE pc.referrer_owner_id = ?
          AND pc.earned_month = ?
          AND pc.status = 'confirmed'
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
      `).bind(settlementId, ownerId, month, settlementId),
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
        expectedAmountKrw,
        settlementId,
        settlementId,
        expectedAmountKrw,
        settlementId,
      ),
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
        error: '정산금이 변경되었습니다. 새로고침 후 다시 확인해주세요.',
        code: 'CALLTAG_ADMIN_SETTLEMENT_AMOUNT_CHANGED',
      });
    }

    const settlement = await env.DB.prepare(`
      SELECT settlement_id, settlement_month, commission_count, gross_sales_krw,
             payout_amount_krw, status, paid_at
      FROM partner_settlements
      WHERE settlement_id = ?
      LIMIT 1
    `).bind(settlementId).first();

    if (settlement?.status !== 'paid' || Number(settlement?.payout_amount_krw || 0) !== expectedAmountKrw) {
      return adminJson(409, {
        ok: false,
        error: '정산 원장 검증이 필요합니다. 지급완료로 처리하지 않았습니다.',
        code: 'CALLTAG_ADMIN_SETTLEMENT_REVIEW_REQUIRED',
        settlementId,
      });
    }

    await recordAdminAudit(env.DB, request, env, identity, 'partner.settlement.pay', ownerId);
    return adminJson(200, {
      ok: true,
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

async function currentPayable(db, ownerId, month) {
  const row = await db.prepare(`
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(pc.commission_amount_krw), 0) AS amount_krw
    FROM partner_commissions pc
    WHERE pc.referrer_owner_id = ?
      AND pc.earned_month = ?
      AND pc.status = 'confirmed'
      AND NOT EXISTS (
        SELECT 1
        FROM partner_settlement_items psi
        JOIN partner_settlements ps ON ps.settlement_id = psi.settlement_id
        WHERE psi.commission_id = pc.id
          AND ps.status IN ('processing','paid','review')
      )
  `).bind(ownerId, month).first();
  return { count: positiveInt(row?.count), amountKrw: positiveInt(row?.amount_krw) };
}

function positiveInt(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(parsed)) : 0;
}

function safeIso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}
