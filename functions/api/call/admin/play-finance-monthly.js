import {
  adminErrorResponse,
  adminJson,
  adminOptions,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';
import { ensureSchemas, syncPlayEarningsHistory } from '../../billing/_playEarningsHistory.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  try {
    if (!env.DB?.prepare) return adminJson(503, { ok: false, error: '관리자 저장소가 연결되지 않았습니다.', code: 'CALLTAG_ADMIN_DB_REQUIRED' });
    const identity = await requireCalltagAdmin(request, env);
    const requestedMonth = validMonth(new URL(request.url).searchParams.get('month'));
    await ensureSchemas(env.DB);

    let sync = null;
    let syncStatus = 'current';
    let syncCode = '';
    try {
      sync = await syncPlayEarningsHistory(env, env.DB, requestedMonth, 2);
      syncStatus = sync.syncedCount > 0 ? 'synced' : 'current';
    } catch (error) {
      syncCode = token(error?.code || '', 80) || 'PLAY_REPORT_SYNC_FAILED';
      syncStatus = syncCode === 'PLAY_REPORT_PERMISSION_REQUIRED' ? 'permission_required' : 'sync_failed';
      console.warn('calltag-play-finance-monthly-sync', syncCode, Number(error?.googleStatus || 0));
      sync = await cachedFallback(env.DB, requestedMonth);
    }

    const report = sync?.report || null;
    const month = validMonth(report?.month || sync?.month || requestedMonth);
    const partner = month ? await partnerAmounts(env.DB, month) : { confirmedKrw: 0, paidKrw: 0 };
    const playNetKrw = money(report?.playNetKrw);
    const partnerConfirmedKrw = money(partner.confirmedKrw);
    const partnerPaidKrw = money(partner.paidKrw);

    await recordAdminAudit(env.DB, request, env, identity, 'play_finance.monthly.read');
    return adminJson(200, {
      ok: true,
      available: !!report,
      status: syncStatus,
      code: syncCode,
      month,
      months: Array.isArray(sync?.months) ? sync.months.filter(validMonth).slice(0, 120) : [],
      backfillRemaining: Math.max(0, Math.trunc(Number(sync?.backfillRemaining || 0))),
      report: report ? {
        month,
        currency: token(report.currency, 12),
        customerNetKrw: money(report.customerNetKrw),
        googleFeeKrw: money(report.googleFeeKrw),
        playNetKrw,
        partnerConfirmedKrw,
        partnerPaidKrw,
        partnerUnpaidKrw: Math.max(0, partnerConfirmedKrw - partnerPaidKrw),
        finalAfterPartnerKrw: Math.max(0, playNetKrw - partnerConfirmedKrw),
        transactionCount: Math.max(0, Math.trunc(Number(report.transactionCount || 0))),
        syncedAt: safeIso(report.syncedAt),
        basis: 'google_play_earnings_report',
        finalBankPayout: false,
      } : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

async function cachedFallback(db, requestedMonth) {
  const rows = await db.prepare(`
    SELECT report_month, currency, customer_net_krw, google_fee_krw,
           net_earnings_krw, transaction_count, synced_at
    FROM calltag_play_earnings_monthly
    ORDER BY report_month DESC
    LIMIT 120
  `).all();
  const list = Array.isArray(rows?.results) ? rows.results : [];
  const months = list.map((row) => validMonth(row.report_month)).filter(Boolean);
  const target = requestedMonth || months[0] || '';
  const row = list.find((item) => validMonth(item.report_month) === target) || null;
  return {
    month: target,
    months,
    backfillRemaining: 0,
    report: row ? {
      month: target,
      currency: token(row.currency, 12),
      customerNetKrw: money(row.customer_net_krw),
      googleFeeKrw: money(row.google_fee_krw),
      playNetKrw: money(row.net_earnings_krw),
      transactionCount: Math.max(0, Math.trunc(Number(row.transaction_count || 0))),
      syncedAt: safeIso(row.synced_at),
    } : null,
  };
}

async function partnerAmounts(db, month) {
  let confirmedKrw = 0;
  let paidKrw = 0;
  try {
    const confirmed = await db.prepare(`
      SELECT COALESCE(SUM(commission_amount_krw), 0) AS value
      FROM partner_commissions
      WHERE earned_month = ? AND status = 'confirmed'
    `).bind(month).first();
    confirmedKrw = money(confirmed?.value);
  } catch {}
  try {
    const paid = await db.prepare(`
      SELECT COALESCE(SUM(payout_amount_krw), 0) AS value
      FROM partner_settlements
      WHERE settlement_month = ? AND status = 'paid'
    `).bind(month).first();
    paidKrw = money(paid?.value);
  } catch {}
  return { confirmedKrw, paidKrw };
}

function validMonth(value) {
  const raw = String(value || '').trim();
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(raw) ? raw : '';
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function safeIso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function token(value, max) {
  const raw = String(value || '').trim();
  return /^[A-Za-z0-9._:+-]*$/.test(raw) ? raw.slice(0, max) : '';
}
