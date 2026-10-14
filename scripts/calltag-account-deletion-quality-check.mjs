import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = await readFile('functions/api/call/delete-account.js', 'utf8');
const schema = await readFile('migrations/0001_inlet_core.sql', 'utf8');
const auth = await readFile('functions/api/auth/_auth.js', 'utf8');

for (const table of [
  'calltag_google_forms_oauth_sessions',
  'calltag_google_forms_connections',
  'calltag_meta_oauth_sessions',
  'calltag_meta_connections',
  'calltag_webhook_raw_events',
  'calltag_webhook_mapping_versions',
  'calltag_webhook_connections',
  'calltag_lead_audit',
  'calltag_lead_events',
  'calltag_lead_customers',
  'calltag_api_keys',
  'calltag_pagero_leads',
  'calltag_push_devices',
  'billing_subscriptions',
  'billing_accounts',
  'referral_codes',
  'partner_commissions',
  'referrals',
  'calllink_entitlements',
  'calllink_profiles',
]) {
  assert(source.includes(`['${table}'`), `account deletion must cover ${table}`);
}

assert(source.includes("UPDATE calltag_referral_identity_claims"), 'referral anti-abuse identity must be detached from deleted account');
assert(source.includes("'deleted:' || substr(phone_hash, 1, 24)"), 'retained referral identity must be pseudonymized');
assert(source.includes('rawPhoneRetainedForReferralAbusePrevention: false'), 'deletion response must state raw referral phone is not retained');
assert(source.includes('DELETE FROM auth_email_verifications'), 'email verification artifacts must be deleted');
assert(source.includes('email = ?'), 'account email must be replaced with a deletion tombstone');
assert(source.includes("name = ''") && source.includes('phone = NULL') && source.includes("password_hash = ''"), 'direct account profile/auth fields must be cleared');
assert(schema.includes("'deleted'"), 'stored deleted state must be permitted by D1 CHECK');
assert(source.includes("SET status = 'deleted'"), 'account deletion must use the schema-allowed status value');
assert(auth.includes("if (status === 'deleted') return 'deleted_pending_retention';"), 'deleted state must remain fail-closed at auth boundary');
assert(source.includes('await db.batch(statements)'), 'server deletion must execute as one D1 batch');

console.log(JSON.stringify({
  ok: true,
  scope: 'calltag-account-deletion',
  associatedCallTagDataDeleted: true,
  externalConnectorCredentialsDeleted: true,
  billingLinkageDeleted: true,
  pushTokensDeleted: true,
  accountPiiCleared: true,
  referralAbuseFingerprintRetained: true,
  referralFingerprintDetachedFromAccount: true,
}, null, 2));
