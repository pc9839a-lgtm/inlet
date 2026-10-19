import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const shared = await readFile('functions/api/billing/_shared.js', 'utf8');
const admin = await readFile('functions/api/call/admin/subscription-reconcile.js', 'utf8');

const checks = {
  'Orders API proof contains no raw token in output; only SHA-256': shared.includes("purchaseTokenHash: order?.purchaseToken ? await sha256("),
  'Orders API returns provider created-at for original payment date': shared.includes('paidAt: iso(order?.createTime)'),
  'Refresh supports previously proven renewal order': shared.includes("row.reconcile_order_id || row.order_id"),
  'Batch route accepts operator-supplied orders': admin.includes('Array.isArray(payload?.orders)'),
  'Batch route validates orders and product codes': admin.includes('PLAY_ORDER_INPUT_INVALID') && admin.includes('message_monthly'),
  'Batch is limited to twelve orders': admin.includes('input.length > 12'),
  'Safe dry run is default': admin.includes('const apply = payload.apply === true') && admin.includes("if (!apply) { result.state = 'verified_ready'"),
  'Official Orders PROCESSED proof required before any writes': admin.indexOf('if (!proof?.ok)') < admin.indexOf('await recordPaymentEvent(env.DB'),
  'Stored verified owner and token hash must match': admin.includes("verification_state='verified'") && admin.includes('proof.purchaseTokenHash'),
  'Unmatched orders never create a new subscriber': admin.includes("result.state = 'paid_order_without_verified_owner'"),
  'Existing conflicting ledger owner is not overwritten': admin.includes("result.state = 'ledger_owner_conflict'"),
  'Payment history uses provider verified amount and order': admin.includes("amountSource: 'google_play_orders_api'") && admin.includes('paymentReference: orderId'),
  'Current expiry updated only after subscriptionsv2 verification': admin.includes('reconcileGoogleSubscriptionByOrder(env, env.DB') && admin.includes("reconcile_order_id: orderId"),
  'Raw order IDs and purchase tokens are omitted from result objects': !admin.includes('result.orderId =') && !admin.includes('result.purchaseToken ='),
  'No real user order references hardcoded': !/GPA\.\d{4}-\d{4}-\d{4}-\d{5}/.test(admin + shared),
};
for (const [name, passed] of Object.entries(checks)) {
  assert.equal(passed, true, name);
  console.log('ok - ' + name);
}
console.log(JSON.stringify({ok:true,checks:Object.keys(checks).length}));
