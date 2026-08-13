import {
  adminErrorResponse,
  adminJson,
  adminOptions,
  ownerIdInput,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';
import { productPriceKrw } from '../../billing/_commissions.js';
import { listPaymentEvents } from '../../billing/_paymentHistory.js';

const CALLTAG_PRODUCTS_SQL = "'call_monthly','message_monthly','all_monthly'";

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return adminOptions();
  if (request.method !== 'GET') return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  try {
    if (!env.DB?.prepare) return adminJson(503, { ok: false, error: '관리자 저장소가 연결되지 않았습니다.', code: 'CALLTAG_ADMIN_DB_REQUIRED' });
    const identity = await requireCalltagAdmin(request, env);
    const ownerId = ownerIdInput(new URL(request.url).searchParams.get('ownerId') || '');
    const profile = await env.DB.prepare('SELECT owner_id FROM calllink_profiles WHERE owner_id = ? LIMIT 1').bind(ownerId).first();
    if (!profile?.owner_id) return adminJson(404, { ok: false, error: '회원을 찾을 수 없습니다.', code: 'CALLTAG_ADMIN_MEMBER_NOT_FOUND' });

    let payments = [];
    try {
      payments = await listPaymentEvents(env.DB, ownerId, 100);
    } catch (error) {
      console.warn('calltag-admin-payment-history', String(error?.message || 'ledger_failed').slice(0, 120));
    }

    let snapshots = [];
    if (!payments.length) {
      try {
        const result = await env.DB.prepare(`
          SELECT product_code, channel, status, started_at, expires_at,
                 verification_state, created_at, updated_at
          FROM billing_subscriptions
          WHERE owner_id = ? AND product_code IN (${CALLTAG_PRODUCTS_SQL})
          ORDER BY datetime(updated_at) DESC, id DESC
          LIMIT 20
        `).bind(ownerId).all();
        snapshots = (Array.isArray(result?.results) ? result.results : []).map((row) => ({
          productCode: token(row.product_code, 80),
          channel: token(row.channel, 32),
          status: token(row.status, 32),
          verificationState: token(row.verification_state, 32),
          amountKrw: Math.max(0, productPriceKrw(String(row.product_code || ''))),
          amountSource: 'list_price_estimate',
          startedAt: safeIso(row.started_at || row.created_at),
          expiresAt: safeIso(row.expires_at),
          updatedAt: safeIso(row.updated_at),
        }));
      } catch {}
    }

    await recordAdminAudit(env.DB, request, env, identity, 'member.payments.read', ownerId);
    return adminJson(200, {
      ok: true,
      ownerId,
      payments: payments.map((item) => ({
        productCode: token(item.productCode, 80),
        channel: token(item.channel, 32),
        eventType: token(item.eventType, 24),
        amountKrw: signedMoney(item.amountKrw),
        amountSource: token(item.amountSource, 48),
        status: token(item.status, 32),
        paidAt: safeIso(item.paidAt),
        month: validMonth(item.month),
      })),
      snapshots,
      exactHistoryAvailable: payments.some((item) => item.amountSource === 'provider_confirmed' || item.amountSource === 'play_earnings_report'),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

function signedMoney(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(-Number.MAX_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, Math.round(parsed))) : 0;
}

function validMonth(value) {
  const raw = String(value || '').trim();
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(raw) ? raw : '';
}

function safeIso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function token(value, max) {
  const raw = String(value || '').trim();
  return /^[A-Za-z0-9._:+-]*$/.test(raw) ? raw.slice(0, max) : '';
}
