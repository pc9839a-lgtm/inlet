import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const paths = {
  rtdn: 'functions/api/billing/google/rtdn.js',
  shared: 'functions/api/billing/_shared.js',
  commissions: 'functions/api/billing/_commissions.js',
  calltagStore: 'functions/api/referrals/_calltag-store.js',
};

const source = {};
for (const [name, relative] of Object.entries(paths)) {
  source[name] = await readFile(path.join(root, relative), 'utf8');
}

for (const relative of Object.values(paths)) {
  await import(pathToFileURL(path.join(root, relative)).href);
}

const checks = {
  'RTDN endpoint is protected by a configured verification token':
    source.rtdn.includes('GOOGLE_PLAY_RTDN_VERIFICATION_TOKEN')
      && source.rtdn.includes('PLAY_RTDN_TOKEN_INVALID'),
  'RTDN can additionally verify authenticated PubSub OIDC claims':
    source.rtdn.includes('GOOGLE_PLAY_RTDN_AUDIENCE')
      && source.rtdn.includes('GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT')
      && source.rtdn.includes('oauth2.googleapis.com/tokeninfo')
      && source.rtdn.includes('PLAY_RTDN_OIDC_INVALID'),
  'PubSub payload is decoded from base64 data':
    source.rtdn.includes('decodePubSubData')
      && source.rtdn.includes('message.data')
      && source.rtdn.includes('atob('),
  'RTDN package is pinned to CallTag':
    source.rtdn.includes("const PACKAGE_NAME = 'kr.pagero.calltag'")
      && source.rtdn.includes('PLAY_RTDN_PACKAGE_MISMATCH'),
  'renewal notification type is a charge event':
    source.rtdn.includes('const CHARGE_NOTIFICATION_TYPES = new Set([2, 4])'),
  'subscription state is re-read from Play after RTDN':
    source.rtdn.includes('verifyGoogleSubscription')
      && source.rtdn.includes('allowInactiveState: true')
      && source.rtdn.includes('skipChannelConflict: true'),
  'shared verification supports server state reconciliation without weakening app calls':
    source.shared.includes('const allowInactiveState = input.allowInactiveState === true')
      && source.shared.includes('const skipChannelConflict = input.skipChannelConflict === true'),
  'RTDN finds owner by hashed purchase token':
    source.rtdn.includes("purchase_token_hash = ?")
      && source.rtdn.includes('await sha256(purchaseToken)')
      && !source.rtdn.includes('purchase_token TEXT'),
  'unmatched subscription asks PubSub to retry instead of losing renewal':
    source.rtdn.includes("status: 'retry_unmatched'")
      && source.rtdn.includes("'PLAY_RTDN_SUBSCRIPTION_UNMATCHED'")
      && source.rtdn.includes('return jsonResponse(request, env, 503'),
  'renewal commission uses Google Play Orders API exact amount':
    source.rtdn.includes('googlePlayOrderPaidAmountKrw')
      && source.rtdn.includes('baseAmountKrw: exactAmount.amountKrw')
      && source.rtdn.includes('requireExactAmount: true'),
  'renewal commission stays idempotent by Play order reference':
    source.rtdn.includes('paymentReference: orderId')
      && source.commissions.includes('INSERT OR IGNORE INTO partner_commissions'),
  'duplicate PubSub messages are idempotent by message id':
    source.rtdn.includes('message_id TEXT PRIMARY KEY')
      && source.rtdn.includes('INSERT OR IGNORE INTO google_play_rtdn_events'),
  'raw purchase token is never persisted in RTDN inbox':
    source.rtdn.includes('purchase_token_hash TEXT NOT NULL')
      && !source.rtdn.includes('purchase_token TEXT NOT NULL')
      && !source.rtdn.includes('payload_json'),
  'voided purchases are preserved for the separate refund reversal step':
    source.rtdn.includes("status: 'deferred_voided'")
      && source.rtdn.includes('STEP5_REFUND_REVERSAL_PENDING')
      && !source.rtdn.includes('UPDATE partner_commissions SET status'),
  'successful Push processing acknowledges with 204':
    source.rtdn.includes('function noContent()')
      && source.rtdn.includes('status: 204'),
  'CallTag commission relationship stays service scoped':
    source.calltagStore.includes('CREATE TABLE IF NOT EXISTS calltag_referrals')
      && source.rtdn.includes('callTagReferralForOwner'),
};

const failed = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? 'ok' : 'failed'} - ${name}`);
}

if (failed.length) {
  throw new Error(`CallTag RTDN quality checks failed: ${failed.join(', ')}`);
}

console.log(JSON.stringify({ ok: true, checks: Object.keys(checks).length }, null, 2));
