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
  const rawReference = text(input.paymentReference, 240);
  if (!rawReference) return { updated: 0, reason: 'PAYMENT_REFERENCE_REQUIRED' };
  const paymentReference = `${channel}:${rawReference}`.slice(0, 240);
  const result = await db.prepare(`
    UPDATE calltag_partner_commissions
    SET status = 'cancelled',
        confirmed_at = '',
        updated_at = CURRENT_TIMESTAMP
    WHERE payment_reference = ?
      AND status != 'cancelled'
  `).bind(paymentReference).run();
  return {
    updated: Number(result?.meta?.changes ?? result?.changes ?? 0),
    paymentReference,
  };
}
