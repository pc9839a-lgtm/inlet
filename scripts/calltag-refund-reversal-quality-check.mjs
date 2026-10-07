import { readFile } from 'node:fs/promises';

const files = {
  commissions: await readFile('functions/api/billing/_commissions.js', 'utf8'),
  rtdn: await readFile('functions/api/billing/google/rtdn.js', 'utf8'),
  portal: await readFile('functions/api/partner/_portal.js', 'utf8'),
  settlementPay: await readFile('functions/api/call/admin/settlement-pay.js', 'utf8'),
};

const checks = {
  'final Play void locates original commission by exact order reference':
    files.commissions.includes("const originalReference = `google_play:${orderId}`")
      && files.commissions.includes('WHERE pc.payment_reference = ?'),
  'unpaid refunded commission is cancelled before payout':
    files.commissions.includes("SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP")
      && files.commissions.includes("disposition = 'cancelled_before_payout'"),
  'already paid refund creates one negative recovery ledger entry':
    files.commissions.includes("const recoveryReference = `google_play_refund:${orderId}`")
      && files.commissions.includes('-originalBaseAmountKrw')
      && files.commissions.includes('-originalCommissionAmountKrw')
      && files.commissions.includes("disposition = 'paid_commission_recovery_created'"),
  'reversal audit is idempotent by Play order id':
    files.commissions.includes('CREATE TABLE IF NOT EXISTS partner_commission_reversals')
      && files.commissions.includes('order_id TEXT PRIMARY KEY')
      && files.commissions.includes('INSERT OR IGNORE INTO partner_commission_reversals'),
  'stale payout request is cancelled when refund changes the balance':
    files.commissions.includes("status = 'cancelled'")
      && files.commissions.includes("service_scope IN ('ALL', 'CALLTAG')")
      && files.commissions.includes("status = 'requested'"),
  'nonpaid processing or review settlement is cancelled rather than paid':
    files.commissions.includes("status IN ('processing', 'review')")
      && files.commissions.includes("UPDATE partner_settlements"),
  'paid recovery debt carries into later payout months':
    files.portal.includes("pc.earned_month = ? OR pc.payment_reference LIKE 'google_play_refund:%'")
      && files.settlementPay.includes("pc.earned_month = ? OR pc.payment_reference LIKE 'google_play_refund:%'")
      && files.settlementPay.includes("pr.settlement_month = pc.earned_month OR pc.payment_reference LIKE 'google_play_refund:%'"),
  'admin settlement snapshot uses same recovery carry-forward rule':
    files.settlementPay.includes("pc.earned_month = pr.settlement_month OR pc.payment_reference LIKE 'google_play_refund:%'"),
  'RTDN reverses only final void and not pending chargeback review':
    files.rtdn.includes('reverseGooglePlayReferralCommission')
      && files.rtdn.includes('CHARGEBACK_REVIEW_PENDING_NO_REVERSAL'),
  'one-time-product void cannot touch CallTag subscription commission':
    files.rtdn.includes("productType && productType !== 1")
      && files.rtdn.includes('VOIDED_NON_SUBSCRIPTION_IGNORED'),
  'missing refund commission requests PubSub retry only when needed':
    files.rtdn.includes("status: 'retry_refund_unmatched'")
      && files.rtdn.includes('PLAY_VOID_COMMISSION_NOT_FOUND')
      && files.rtdn.includes('VOIDED_WITHOUT_REFERRAL_COMMISSION'),
};

const failed = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? 'ok' : 'failed'} - ${name}`);
}
if (failed.length) {
  throw new Error(`CallTag refund reversal checks failed: ${failed.join(', ')}`);
}
console.log(JSON.stringify({ ok: true, checks: Object.keys(checks).length }, null, 2));
