import { ensureBillingSchema } from './_shared.js';

const COMMISSION_RATE_BPS = 2000;
const PRODUCT_PRICE_KRW = Object.freeze({
  pagero_monthly: 3500,
  pagero_pro_monthly: 5500,
  pagero_domain_monthly: 1000,
  call_monthly: 6000,
  message_monthly: 6000,
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
  const baseAmountKrw = safeAmount(input.baseAmountKrw, productPriceKrw(productCode));
  const subscriptionId = Number(input.subscriptionId || 0) || null;
  const status = ['estimated', 'confirmed', 'cancelled'].includes(String(input.status || ''))
    ? String(input.status)
    : 'confirmed';

  if (!referredOwnerId || !paymentReference || !baseAmountKrw) {
    return { created: false, reason: 'COMMISSION_INPUT_INCOMPLETE' };
  }

  const referral = await db.prepare(`
    SELECT id, referrer_owner_id, referred_owner_id, status, first_paid_at
    FROM referrals
    WHERE referred_owner_id = ?
    LIMIT 1
  `).bind(referredOwnerId).first();
  if (!referral?.referrer_owner_id) {
    return { created: false, reason: 'REFERRAL_NOT_FOUND' };
  }

  const commissionAmountKrw = Math.floor(baseAmountKrw * COMMISSION_RATE_BPS / 10000);
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
    String(referral.referrer_owner_id),
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
    UPDATE referrals
    SET status = CASE WHEN status = 'applied' THEN 'qualified' ELSE status END,
        first_paid_at = CASE WHEN first_paid_at = '' THEN CURRENT_TIMESTAMP ELSE first_paid_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE referred_owner_id = ?
  `).bind(referredOwnerId).run();

  const created = Number(result?.meta?.changes ?? result?.changes ?? 0) > 0;
  return {
    created,
    duplicate: !created,
    referrerOwnerId: String(referral.referrer_owner_id),
    referredOwnerId,
    productCode,
    paymentReference,
    baseAmountKrw,
    commissionAmountKrw,
    commissionRateBps: COMMISSION_RATE_BPS,
    status,
  };
}
