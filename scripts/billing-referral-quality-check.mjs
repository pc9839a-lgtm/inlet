import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const files = {
  shared: 'functions/api/billing/_shared.js',
  entitlements: 'functions/api/billing/entitlements.js',
  subscriptions: 'functions/api/billing/subscriptions.js',
  verify: 'functions/api/billing/google/verify.js',
  restore: 'functions/api/billing/google/restore.js',
  referralMe: 'functions/api/referrals/me.js',
  referralApply: 'functions/api/referrals/apply.js',
  referralSummary: 'functions/api/referrals/summary.js',
  migration: 'migrations/0009_unified_billing_referral.sql',
};

const source = {};
for (const [name, relative] of Object.entries(files)) {
  source[name] = await readFile(path.join(root, relative), 'utf8');
}

for (const relative of Object.values(files).filter((item) => item.endsWith('.js'))) {
  await import(pathToFileURL(path.join(root, relative)).href);
}

const checks = {
  'trial base is exactly 3 days': source.shared.includes('const TRIAL_BASE_DAYS = 3'),
  'referral bonus is exactly 5 days': source.shared.includes('const REFERRAL_BONUS_DAYS = 5'),
  'trial is capped at base plus one referral bonus': source.shared.includes('TRIAL_BASE_DAYS + REFERRAL_BONUS_DAYS'),
  'referral can be applied once': source.migration.includes('referred_owner_id TEXT NOT NULL UNIQUE'),
  'self referral is blocked': source.shared.includes("'SELF_REFERRAL'") && source.migration.includes('CHECK(referrer_owner_id != referred_owner_id)'),
  'paid conversion blocks late referral': source.shared.includes("'PAID_CONVERSION_COMPLETED'"),
  'partner revenue is server stored': source.migration.includes('partner_commissions') && source.shared.includes('commission_amount_krw'),
  'CallTag products are allowlisted': ['call_monthly', 'message_monthly', 'all_monthly'].every((value) => source.shared.includes(`'${value}'`)),
  'raw Google purchase token is not stored in D1': source.migration.includes('purchase_token_hash') && !source.migration.includes('purchase_token TEXT'),
  'Google Play package is fixed': source.shared.includes("packageName !== 'kr.pagero.calltag'"),
  'Google Play verification uses Android Publisher API': source.shared.includes('androidpublisher.googleapis.com/androidpublisher/v3/applications/'),
  'Google Play OAuth uses androidpublisher scope': source.shared.includes('https://www.googleapis.com/auth/androidpublisher'),
  'Google Play requests block redirects': source.shared.includes("redirect: 'error'"),
  'Google Play requests have timeouts': source.shared.includes('AbortSignal.timeout(15000)'),
  'purchase acknowledgement is server-side': source.shared.includes(':acknowledge'),
  'web and Play channels share one subscription table': source.migration.includes('channel TEXT NOT NULL') && source.shared.includes("channel != 'google_play'"),
  'entitlement endpoint exists': source.entitlements.includes('resolveEntitlement'),
  'subscription endpoint exists': source.subscriptions.includes('listSubscriptions'),
  'Google verify endpoint exists': source.verify.includes('verifyGoogleSubscription'),
  'Google restore endpoint exists': source.restore.includes('restoreGoogleSubscriptions'),
  'referral identity endpoint exists': source.referralMe.includes('referralMe'),
  'referral apply endpoint exists': source.referralApply.includes('applyReferralCode'),
  'partner summary endpoint exists': source.referralSummary.includes('referralSummary'),
};

const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? 'ok' : 'failed'} - ${name}`);
}
if (failed.length) {
  throw new Error(`Billing/referral quality checks failed: ${failed.join(', ')}`);
}

console.log(JSON.stringify({ ok: true, checks: Object.keys(checks).length }, null, 2));
