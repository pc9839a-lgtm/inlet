import { ensureBillingSchema } from './_shared.js';
import { resolvePartnerCommissionRateBps } from './_partnerFinance.js';
import {
  callTagReferralForReferred,
  ensureCallTagReferralSchema,
  isCallTagProduct,
} from '../referrals/_calltag-ledger.js';

const CALLTAG_CASH_COMMISSION_PRODUCTS = new Set(['call_monthly', 'message_monthly', 'all_monthly']);
const CALLTAG_COMMISSION_RATE_BPS = 2000;

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

async function ensureCommissionSchema(db, calltag = false) {
  await ensureBillingSchema(db);
  if (calltag) await ensureCallTagReferralSchema(db);
}

export async function recordReferralCommission(db, input = {}) {
  const referredOwnerId = text(input.referredOwnerId, 120);
  const productCode = text(input.productCode, 120);
  const rawReference = text(input.paymentReference, 240);
  const channel = text(input.channel || 'billing', 40) || 'billing';
  const paymentReference = rawReference ? `${channel}:${rawReference}`.slice(0, 240) : '';
  const baseAmountKrw = safeAmount(input.baseAmountKrw, productPriceKrw(productCode));
  const subscriptionId = Number(input.subscriptionId || 0) || null;
  const status = ['estimated', 'confirmed', 'cancelled'].includes(String(input.status || ''))
    ? String(input.status)
    : 'confirmed';

  if (!referredOwnerId || !paymentReference || !baseAmountKrw) {
    return { created: false, reason: 'COMMISSION_INPUT_INCOMPLETE' };
  }

  const calltag = isCallTagProduct(productCode);
  await ensureCommissionSchema(db, calltag);
  const referral = calltag
    ? await callTagReferralForReferred(db, referredOwnerId)
    : await db.prepare(`
        SELECT id, referrer_owner_id, referred_owner_id, status, first_paid_at
        FROM referrals
        WHERE referred_owner_id = ?
        LIMIT 1
      `).bind(referredOwnerId).first();
  if (!referral?.referrer_owner_id) {
    return { created: false, reason: 'REFERRAL_NOT_FOUND' };
  }

  const referrerOwnerId = String(referral.referrer_owner_id);
  const serviceScope = calltag ? 'calltag' : 'pagero';
  // CallTag marketing referrals use a fixed 20% recurring cash commission.
  // Other partner products keep the controlled partner profile rate policy.
  const commissionRateBps = CALLTAG_CASH_COMMISSION_PRODUCTS.has(productCode)
    ? CALLTAG_COMMISSION_RATE_BPS
    : await resolvePartnerCommissionRateBps(db, referrerOwnerId);
  const commissionAmountKrw = Math.floor(baseAmountKrw * commissionRateBps / 10000);
  if (!commissionAmountKrw) {
    return { created: false, reason: 'COMMISSION_AMOUNT_ZERO' };
  }

  const confirmedAt = status === 'confirmed' ? new Date().toISOString() : '';
  const result = calltag
    ? await db.prepare(`
        INSERT OR IGNORE INTO calltag_partner_commissions (
          referrer_owner_id,
          referred_owner_id,
          subscription_id,
          product_code,
          payment_reference,
          base_amount_krw,
          commission_amount_krw,
          status,
          earned_month,
          confirmed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        referrerOwnerId,
        referredOwnerId,
        subscriptionId,
        productCode,
        paymentReference,
        baseAmountKrw,
        commissionAmountKrw,
        status,
        currentMonth(),
        confirmedAt,
      ).run()
    : await db.prepare(`
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
        confirmedAt,
      ).run();

  const referralTable = calltag ? 'calltag_referrals' : 'referrals';
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
    serviceScope,
  };
}

export async function cancelReferralCommission(db, input = {}) {
  await ensureCommissionSchema(db, true);
  const channel = text(input.channel || 'google_play', 40) || 'google_play';
  const rootReference = normalizedPaymentReference(channel, input.paymentReference);
  if (!rootReference) return { updated: 0, reason: 'PAYMENT_REFERENCE_REQUIRED' };

  const existing = await db.prepare(`
    SELECT referred_owner_id, product_code, subscription_id
    FROM calltag_partner_commissions
    WHERE payment_reference = ?
    LIMIT 1
  `).bind(rootReference).first();
  if (!existing?.referred_owner_id) {
    return { updated: 0, reason: 'COMMISSION_NOT_FOUND', paymentReference: rootReference };
  }

  return reconcileCallTagReferralCommission(db, {
    referredOwnerId: existing.referred_owner_id,
    productCode: existing.product_code,
    paymentReference: text(input.paymentReference, 200),
    subscriptionId: existing.subscription_id,
    baseAmountKrw: 0,
    channel,
    status: 'cancelled',
    eventKey: input.eventKey || 'voided',
  });
}

function signedAmount(value) {
  const amount = Math.round(Number(value || 0));
  return Number.isFinite(amount) ? amount : 0;
}

function normalizedPaymentReference(channel = 'billing', rawReference = '') {
  const safeChannel = text(channel, 40) || 'billing';
  const raw = text(rawReference, 200);
  return raw ? `${safeChannel}:${raw}`.slice(0, 220) : '';
}

async function callTagCommissionSettlementLock(db, commissionId) {
  if (!commissionId) return null;
  return db.prepare(`
    SELECT ps.settlement_id, ps.status
    FROM calltag_partner_settlement_items psi
    JOIN partner_settlements ps ON ps.settlement_id = psi.settlement_id
    WHERE psi.commission_id = ?
      AND ps.status IN ('processing','paid','review')
    ORDER BY ps.created_at DESC
    LIMIT 1
  `).bind(commissionId).first();
}

async function callTagCommissionLedgerNet(db, rootReference) {
  const result = await db.prepare(`
    SELECT
      COALESCE(SUM(base_amount_krw), 0) AS base_amount_krw,
      COALESCE(SUM(commission_amount_krw), 0) AS commission_amount_krw
    FROM calltag_partner_commissions
    WHERE payment_reference = ?
       OR payment_reference LIKE ?
  `).bind(rootReference, `${rootReference}:adj:%`).first();
  return {
    baseAmountKrw: signedAmount(result?.base_amount_krw),
    commissionAmountKrw: signedAmount(result?.commission_amount_krw),
  };
}

/**
 * Reconciles one verified CallTag payment to its current net paid amount.
 *
 * Unsettled rows are updated in place. Once a commission has entered a settlement,
 * its historical row is immutable; later refunds/chargebacks create a signed
 * adjustment that is carried into the next payout. This prevents an already-paid
 * referral reward from disappearing without a compensating ledger entry.
 */
export async function reconcileCallTagReferralCommission(db, input = {}) {
  const referredOwnerId = text(input.referredOwnerId, 120);
  const productCode = text(input.productCode, 120);
  const channel = text(input.channel || 'google_play', 40) || 'google_play';
  const rootReference = normalizedPaymentReference(channel, input.paymentReference);
  const subscriptionId = Number(input.subscriptionId || 0) || null;
  const targetBaseAmountKrw = Math.max(0, signedAmount(input.baseAmountKrw));
  const targetStatus = ['confirmed', 'estimated', 'cancelled'].includes(String(input.status || ''))
    ? String(input.status)
    : 'confirmed';
  const eventKey = text(input.eventKey || new Date().toISOString(), 80)
    .replace(/[^A-Za-z0-9._:-]/g, '_');

  if (!referredOwnerId || !rootReference || !isCallTagProduct(productCode)) {
    return { reconciled: false, reason: 'CALLTAG_RECONCILE_INPUT_INCOMPLETE' };
  }

  await ensureCommissionSchema(db, true);
  const referral = await callTagReferralForReferred(db, referredOwnerId);
  if (!referral?.referrer_owner_id) {
    return { reconciled: false, reason: 'REFERRAL_NOT_FOUND' };
  }

  const referrerOwnerId = String(referral.referrer_owner_id);
  const targetCommissionKrw = targetStatus === 'cancelled'
    ? 0
    : Math.floor(targetBaseAmountKrw * CALLTAG_COMMISSION_RATE_BPS / 10000);

  const original = await db.prepare(`
    SELECT id, referrer_owner_id, referred_owner_id, subscription_id, product_code,
           payment_reference, base_amount_krw, commission_amount_krw, status,
           earned_month, confirmed_at, created_at, updated_at
    FROM calltag_partner_commissions
    WHERE payment_reference = ?
    LIMIT 1
  `).bind(rootReference).first();

  if (!original?.id) {
    if (targetCommissionKrw <= 0 || targetStatus === 'cancelled') {
      return { reconciled: true, created: false, reason: 'NO_COMMISSION_TO_REVERSE' };
    }
    return recordReferralCommission(db, {
      referredOwnerId,
      productCode,
      paymentReference: text(input.paymentReference, 200),
      subscriptionId,
      baseAmountKrw: targetBaseAmountKrw,
      channel,
      status: targetStatus,
    });
  }

  const lock = await callTagCommissionSettlementLock(db, original.id);
  if (!lock) {
    const confirmedAt = targetStatus === 'confirmed' ? new Date().toISOString() : '';
    const result = await db.prepare(`
      UPDATE calltag_partner_commissions
      SET subscription_id = ?,
          product_code = ?,
          base_amount_krw = ?,
          commission_amount_krw = ?,
          status = ?,
          confirmed_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      subscriptionId || original.subscription_id || null,
      productCode,
      targetBaseAmountKrw,
      targetCommissionKrw,
      targetStatus,
      confirmedAt,
      original.id,
    ).run();
    return {
      reconciled: true,
      updated: Number(result?.meta?.changes ?? result?.changes ?? 0),
      locked: false,
      paymentReference: rootReference,
      baseAmountKrw: targetBaseAmountKrw,
      commissionAmountKrw: targetCommissionKrw,
      status: targetStatus,
    };
  }

  // A pending refund cannot rewrite money already in a settlement. Wait for the
  // final Google order/void event and then create a compensating adjustment.
  if (targetStatus === 'estimated') {
    return {
      reconciled: true,
      locked: true,
      held: true,
      paymentReference: rootReference,
      settlementId: String(lock.settlement_id || ''),
    };
  }

  const current = await callTagCommissionLedgerNet(db, rootReference);
  const deltaBaseKrw = targetBaseAmountKrw - current.baseAmountKrw;
  const deltaCommissionKrw = targetCommissionKrw - current.commissionAmountKrw;
  if (deltaBaseKrw === 0 && deltaCommissionKrw === 0) {
    return {
      reconciled: true,
      locked: true,
      duplicate: true,
      paymentReference: rootReference,
      status: targetStatus,
    };
  }

  const adjustmentReference = `${rootReference}:adj:${eventKey}`.slice(0, 240);
  const result = await db.prepare(`
    INSERT OR IGNORE INTO calltag_partner_commissions (
      referrer_owner_id,
      referred_owner_id,
      subscription_id,
      product_code,
      payment_reference,
      base_amount_krw,
      commission_amount_krw,
      status,
      earned_month,
      confirmed_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    referrerOwnerId,
    referredOwnerId,
    subscriptionId || original.subscription_id || null,
    productCode,
    adjustmentReference,
    deltaBaseKrw,
    deltaCommissionKrw,
    currentMonth(),
    new Date().toISOString(),
  ).run();

  return {
    reconciled: true,
    locked: true,
    adjustmentCreated: Number(result?.meta?.changes ?? result?.changes ?? 0) > 0,
    paymentReference: rootReference,
    adjustmentReference,
    deltaBaseKrw,
    deltaCommissionKrw,
    targetBaseAmountKrw,
    targetCommissionKrw,
    status: targetStatus,
  };
}
