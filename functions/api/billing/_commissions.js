import { ensureBillingSchema } from './_shared.js';
import {
  ensurePartnerFinanceSchema,
  resolvePartnerCommissionRateBps,
} from './_partnerFinance.js';
import { ensurePartnerPortalSchema } from '../partner/_portal.js';
import { ensureCallTagReferralSchema } from '../referrals/_calltag-store.js';
import { readCallTagReferralProgramConfig } from '../referrals/_calltag-program.js';

const CALLTAG_CASH_COMMISSION_PRODUCTS = new Set(['call_monthly', 'message_monthly', 'all_monthly']);
const CALLTAG_COMMISSION_RATE_BPS = 2000;

// Treat 0 as an explicit server configuration, never as "missing".
// Previously "configured 0" fell back to 20% via the || operator.
export function resolveCallTagCommissionRateBps(program = {}) {
  const configured = program?.commissionRateBps;
  if (configured === undefined || configured === null || configured === '') {
    return CALLTAG_COMMISSION_RATE_BPS;
  }
  const parsed = Number(configured);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 5000
    ? parsed : CALLTAG_COMMISSION_RATE_BPS;
}

const PRODUCT_PRICE_KRW = Object.freeze({
  pagero_monthly: 3500,
  pagero_pro_monthly: 5500,
  pagero_domain_monthly: 1000,
  call_monthly: 1900,
  message_monthly: 990,
  all_monthly: 6000,
});

function text(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function safeAmount(value, fallback = 0) {
  const amount = Math.round(Number(value || fallback));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function productPriceKrw(productCode = '') {
  return Number(PRODUCT_PRICE_KRW[text(productCode, 120)] || 0);
}

export async function recordReferralCommission(db, input = {}) {
  await ensureBillingSchema(db);
  const referredOwnerId = text(input.referredOwnerId, 120);
  const productCode = text(input.productCode, 120);
  const rawReference = text(input.paymentReference, 240);
  const channel = text(input.channel || 'billing', 40) || 'billing';
  const paymentReference = rawReference ? `${channel}:${rawReference}`.slice(0, 240) : '';
  const requireExactAmount = input.requireExactAmount === true;
  const baseAmountKrw = requireExactAmount
    ? safeAmount(input.baseAmountKrw, 0)
    : safeAmount(input.baseAmountKrw, productPriceKrw(productCode));
  const subscriptionId = Number(input.subscriptionId || 0) || null;
  const status = ['estimated', 'confirmed', 'cancelled'].includes(String(input.status || ''))
    ? String(input.status)
    : 'confirmed';

  if (!referredOwnerId || !paymentReference || !baseAmountKrw) {
    return {
      created: false,
      reason: requireExactAmount && !baseAmountKrw
        ? 'COMMISSION_EXACT_AMOUNT_REQUIRED'
        : 'COMMISSION_INPUT_INCOMPLETE',
    };
  }

  const isCallTagProduct = CALLTAG_CASH_COMMISSION_PRODUCTS.has(productCode);
  let callTagProgram = null;
  if (isCallTagProduct) {
    await ensureCallTagReferralSchema(db);
    callTagProgram = await readCallTagReferralProgramConfig(db);
    if (!callTagProgram.enabled || !callTagProgram.commissionEnabled) {
      return { created: false, reason: 'CALLTAG_COMMISSION_PAUSED' };
    }
  }
  const referralTable = isCallTagProduct ? 'calltag_referrals' : 'referrals';

  const referral = await db.prepare(`
    SELECT id, referrer_owner_id, referred_owner_id, status, first_paid_at
    FROM ${referralTable}
    WHERE referred_owner_id = ?
    LIMIT 1
  `).bind(referredOwnerId).first();
  if (!referral?.referrer_owner_id) {
    return { created: false, reason: 'REFERRAL_NOT_FOUND' };
  }

  const referrerOwnerId = String(referral.referrer_owner_id);
  // CallTag marketing referrals use a fixed 20% recurring cash commission.
  // Other partner products keep the controlled partner profile rate policy.
  const commissionRateBps = isCallTagProduct
    ? resolveCallTagCommissionRateBps(callTagProgram)
    : await resolvePartnerCommissionRateBps(db, referrerOwnerId);
  const commissionAmountKrw = Math.floor(baseAmountKrw * commissionRateBps / 10000);
  if (!commissionAmountKrw) {
    return { created: false, reason: 'COMMISSION_AMOUNT_ZERO' };
  }

  const result = await db.prepare(`
    INSERT OR IGNORE INTO partner_commissions (
      referrer_owner_id,
      referred_owner_id,
      subscription_id,
      payment_reference,
      base_amount_krw,
      commission_amount_krw,
      status,
      earned_month,
      confirmed_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    referrerOwnerId,
    referredOwnerId,
    subscriptionId,
    paymentReference,
    baseAmountKrw,
    commissionAmountKrw,
    status,
    currentMonth(),
    status === 'confirmed' ? new Date().toISOString() : '',
  ).run();

  await db.prepare(`
    UPDATE ${referralTable}
    SET status = CASE WHEN status = 'applied' THEN 'qualified' ELSE status END,
        first_paid_at = CASE WHEN first_paid_at = '' THEN CURRENT_TIMESTAMP ELSE first_paid_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE referred_owner_id = ?
  `).bind(referredOwnerId).run();

  const created = Number(result?.meta?.changes ?? result?.changes ?? 0) > 0;
  return {
    created,
    duplicate: !created,
    referrerOwnerId,
    referredOwnerId,
    productCode,
    paymentReference,
    baseAmountKrw,
    commissionAmountKrw,
    commissionRateBps,
    status,
  };
}


async function ensureCommissionReversalSchema(db) {
  await Promise.all([
    ensureBillingSchema(db),
    ensurePartnerFinanceSchema(db),
    ensurePartnerPortalSchema(db),
  ]);
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_commission_reversals (
      order_id TEXT PRIMARY KEY,
      original_commission_id INTEGER NOT NULL,
      recovery_commission_id INTEGER,
      referrer_owner_id TEXT NOT NULL,
      referred_owner_id TEXT NOT NULL,
      subscription_id INTEGER,
      base_amount_krw INTEGER NOT NULL DEFAULT 0,
      commission_amount_krw INTEGER NOT NULL DEFAULT 0,
      refund_type INTEGER NOT NULL DEFAULT 0,
      source_event_id TEXT NOT NULL DEFAULT '',
      disposition TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_partner_commission_reversals_referrer
    ON partner_commission_reversals(referrer_owner_id, created_at DESC)
  `).run();
}

export async function reverseGooglePlayReferralCommission(db, input = {}) {
  await ensureCommissionReversalSchema(db);

  const orderId = text(input.orderId, 220);
  const sourceEventId = text(input.sourceEventId, 220);
  const refundType = Math.max(0, Math.trunc(Number(input.refundType || 0)));
  if (!orderId) {
    return { reversed: false, retry: false, reason: 'PLAY_VOID_ORDER_ID_REQUIRED' };
  }

  const originalReference = `google_play:${orderId}`.slice(0, 240);
  const recoveryReference = `google_play_refund:${orderId}`.slice(0, 240);
  const existingAudit = await db.prepare(`
    SELECT order_id, original_commission_id, recovery_commission_id,
           referrer_owner_id, referred_owner_id, disposition
    FROM partner_commission_reversals
    WHERE order_id = ?
    LIMIT 1
  `).bind(orderId).first();
  if (existingAudit?.order_id) {
    return {
      reversed: true,
      duplicate: true,
      retry: false,
      reason: text(existingAudit.disposition, 80) || 'ALREADY_REVERSED',
      referrerOwnerId: text(existingAudit.referrer_owner_id, 120),
      referredOwnerId: text(existingAudit.referred_owner_id, 120),
    };
  }

  const original = await db.prepare(`
    SELECT
      pc.id,
      pc.referrer_owner_id,
      pc.referred_owner_id,
      pc.subscription_id,
      pc.base_amount_krw,
      pc.commission_amount_krw,
      pc.status,
      pc.earned_month,
      pc.confirmed_at,
      pc.created_at,
      s.product_code
    FROM partner_commissions pc
    LEFT JOIN billing_subscriptions s ON s.id = pc.subscription_id
    WHERE pc.payment_reference = ?
    LIMIT 1
  `).bind(originalReference).first();

  if (!original?.id) {
    return {
      reversed: false,
      retry: true,
      reason: 'PLAY_VOID_COMMISSION_NOT_FOUND',
      orderId,
    };
  }

  const productCode = text(original.product_code, 120);
  if (!CALLTAG_CASH_COMMISSION_PRODUCTS.has(productCode)) {
    return {
      reversed: false,
      retry: false,
      reason: 'PLAY_VOID_NOT_CALLTAG_COMMISSION',
      orderId,
    };
  }

  const referrerOwnerId = text(original.referrer_owner_id, 120);
  const referredOwnerId = text(original.referred_owner_id, 120);
  const originalCommissionId = Number(original.id || 0);
  const originalBaseAmountKrw = Math.abs(Math.trunc(Number(original.base_amount_krw || 0)));
  const originalCommissionAmountKrw = Math.abs(Math.trunc(Number(original.commission_amount_krw || 0)));

  const settlementRows = await db.prepare(`
    SELECT ps.settlement_id, ps.status
    FROM partner_settlement_items psi
    JOIN partner_settlements ps ON ps.settlement_id = psi.settlement_id
    WHERE psi.commission_id = ?
      AND ps.status IN ('processing', 'review', 'paid')
    ORDER BY ps.created_at DESC
  `).bind(originalCommissionId).all();
  const settlements = Array.isArray(settlementRows?.results) ? settlementRows.results : [];
  const wasPaid = settlements.some((row) => String(row?.status || '') === 'paid');
  const nonPaidSettlementIds = settlements
    .filter((row) => ['processing', 'review'].includes(String(row?.status || '')))
    .map((row) => text(row?.settlement_id, 120))
    .filter(Boolean);

  // Any pending CallTag payout snapshot is stale as soon as a refund/chargeback lands.
  // Cancel it so the partner can request again from the recalculated net balance.
  await db.prepare(`
    UPDATE partner_payout_requests
    SET status = 'cancelled',
        processed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE owner_id = ?
      AND status = 'requested'
      AND service_scope IN ('ALL', 'CALLTAG')
  `).bind(referrerOwnerId).run();

  for (const settlementId of nonPaidSettlementIds) {
    await db.batch([
      db.prepare(`
        UPDATE partner_settlements
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE settlement_id = ? AND status IN ('processing', 'review')
      `).bind(settlementId),
      db.prepare(`
        UPDATE partner_payout_requests
        SET status = 'cancelled',
            processed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE settlement_id = ?
          AND owner_id = ?
          AND status IN ('processing', 'review', 'requested')
      `).bind(settlementId, referrerOwnerId),
    ]);
  }

  await db.prepare(`
    UPDATE partner_commissions
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(originalCommissionId).run();

  let recoveryCommissionId = null;
  let disposition = 'cancelled_before_payout';

  if (wasPaid && originalCommissionAmountKrw > 0) {
    await db.prepare(`
      INSERT OR IGNORE INTO partner_commissions (
        referrer_owner_id,
        referred_owner_id,
        subscription_id,
        payment_reference,
        base_amount_krw,
        commission_amount_krw,
        status,
        earned_month,
        confirmed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      referrerOwnerId,
      referredOwnerId,
      Number(original.subscription_id || 0) || null,
      recoveryReference,
      -originalBaseAmountKrw,
      -originalCommissionAmountKrw,
      currentMonth(),
    ).run();

    const recovery = await db.prepare(`
      SELECT id
      FROM partner_commissions
      WHERE payment_reference = ?
      LIMIT 1
    `).bind(recoveryReference).first();
    recoveryCommissionId = Number(recovery?.id || 0) || null;
    disposition = 'paid_commission_recovery_created';
  }

  await db.prepare(`
    INSERT OR IGNORE INTO partner_commission_reversals (
      order_id,
      original_commission_id,
      recovery_commission_id,
      referrer_owner_id,
      referred_owner_id,
      subscription_id,
      base_amount_krw,
      commission_amount_krw,
      refund_type,
      source_event_id,
      disposition,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    orderId,
    originalCommissionId,
    recoveryCommissionId,
    referrerOwnerId,
    referredOwnerId,
    Number(original.subscription_id || 0) || null,
    originalBaseAmountKrw,
    originalCommissionAmountKrw,
    refundType,
    sourceEventId,
    disposition,
  ).run();

  return {
    reversed: true,
    duplicate: false,
    retry: false,
    reason: disposition,
    wasPaid,
    orderId,
    referrerOwnerId,
    referredOwnerId,
    productCode,
    originalCommissionId,
    recoveryCommissionId,
    baseAmountKrw: originalBaseAmountKrw,
    commissionAmountKrw: originalCommissionAmountKrw,
  };
}
