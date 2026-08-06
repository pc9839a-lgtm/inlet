import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const files = {
  shared: 'functions/api/billing/_shared.js',
  readiness: 'functions/api/billing/_readiness.js',
  entitlements: 'functions/api/billing/entitlements.js',
  subscriptions: 'functions/api/billing/subscriptions.js',
  billingReadiness: 'functions/api/billing/readiness.js',
  webPrecheck: 'functions/api/billing/web/precheck.js',
  verify: 'functions/api/billing/google/verify.js',
  restore: 'functions/api/billing/google/restore.js',
  referralMe: 'functions/api/referrals/me.js',
  referralApply: 'functions/api/referrals/apply.js',
  referralSummary: 'functions/api/referrals/summary.js',
  referralLanding: 'functions/r/[code].js',
  migration: 'migrations/0009_unified_billing_referral.sql',
};

const source = {};
for (const [name, relative] of Object.entries(files)) {
  source[name] = await readFile(path.join(root, relative), 'utf8');
}

for (const relative of Object.values(files).filter((item) => item.endsWith('.js'))) {
  await import(pathToFileURL(path.join(root, relative)).href);
}

const settingsSource = {
  navigation: await readFile(path.join(root, 'src/panels/settings/SettingsPanelBody.jsx'), 'utf8'),
  sections: await readFile(path.join(root, 'src/panels/settings/SettingsPrimarySections.jsx'), 'utf8'),
  repository: await readFile(path.join(root, 'src/lib/accountFinanceRepository.js'), 'utf8'),
  billing: await readFile(path.join(root, 'src/panels/settings/BillingSettingsSection.jsx'), 'utf8'),
  referral: await readFile(path.join(root, 'src/panels/settings/ReferralSettingsSection.jsx'), 'utf8'),
};

const verifyGateIndex = source.verify.indexOf('assertGooglePlayBillingReady(env);');
const verifyActionIndex = source.verify.indexOf('const entitlement = await verifyGoogleSubscription');
const restoreGateIndex = source.restore.indexOf('assertGooglePlayBillingReady(env);');
const restoreActionIndex = source.restore.indexOf('const entitlement = await restoreGoogleSubscriptions');

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
  'billing readiness endpoint exists': source.billingReadiness.includes('billingReadiness'),
  'web checkout precheck exists': source.webPrecheck.includes('checkoutDecision'),
  'Google verify endpoint exists': source.verify.includes('verifyGoogleSubscription'),
  'Google restore endpoint exists': source.restore.includes('restoreGoogleSubscriptions'),
  'referral identity endpoint exists': source.referralMe.includes('referralMe'),
  'referral apply endpoint exists': source.referralApply.includes('applyReferralCode'),
  'partner summary endpoint exists': source.referralSummary.includes('referralSummary'),
  'Play billing defaults to explicit release flags': source.readiness.includes('GOOGLE_PLAY_BILLING_ENABLED') && source.readiness.includes('GOOGLE_PLAY_PRODUCTS_READY'),
  'Play billing has preregistration stage': source.readiness.includes("stage = 'pre_registration'") && source.readiness.includes("'PLAY_RELEASE_DISABLED'"),
  'entitlement exposes Play readiness': source.entitlements.includes('billingAvailability') && source.entitlements.includes('googlePlayBillingReadiness'),
  'verify is blocked before publisher verification': verifyGateIndex >= 0 && verifyActionIndex >= 0 && verifyGateIndex < verifyActionIndex,
  'restore is blocked before publisher verification': restoreGateIndex >= 0 && restoreActionIndex >= 0 && restoreGateIndex < restoreActionIndex,
  'unready Play returns stable server code': source.readiness.includes("'PLAY_BILLING_NOT_READY'"),
  'readiness response does not expose credentials': !source.readiness.includes('credentialsConfigured,'),
  'entitlement exposes authoritative server time': source.entitlements.includes('serverNow') && source.entitlements.includes('new Date()'),
  'customer records remain available after expiry': source.entitlements.includes('customerDataRead: true') && source.entitlements.includes('consultationHistoryRead: true'),
  'paid automation is feature gated': source.entitlements.includes('callManagement: active') && source.entitlements.includes('messageAutomation: active'),
  'trial ending and expiry notices exist': source.entitlements.includes('TRIAL_ENDING_24H') && source.entitlements.includes('TRIAL_EXPIRED'),
  'web precheck blocks existing Play subscription': source.webPrecheck.includes('GOOGLE_PLAY_SUBSCRIPTION_ACTIVE'),
  'web precheck blocks existing web subscription': source.webPrecheck.includes('WEB_SUBSCRIPTION_ACTIVE'),
  'referral links use dedicated landing path': source.referralMe.includes('https://pagero.kr/r/'),
  'referral landing opens CallTag scheme': source.referralLanding.includes('calltag://referral?code='),
  'referral landing is noindex': source.referralLanding.includes('noindex,nofollow'),
  'partner center is excluded': source.referralSummary.includes('partnerCenterAvailable = false') && source.referralSummary.includes("partnerCenterUrl = ''"),
  'settings navigation exposes billing and referral': settingsSource.navigation.includes('요금제·결제') && settingsSource.navigation.includes('추천인'),
  'settings render billing and referral sections': settingsSource.sections.includes('BillingSettingsSection') && settingsSource.sections.includes('ReferralSettingsSection'),
  'settings read existing unified subscription API': settingsSource.repository.includes("'/api/billing/subscriptions'"),
  'settings read existing referral identity API': settingsSource.repository.includes("'/api/referrals/me'"),
  'settings read existing referral summary API': settingsSource.repository.includes("'/api/referrals/summary'"),
  'settings apply referral through existing API': settingsSource.repository.includes("'/api/referrals/apply'"),
  'settings do not create a parallel finance API': !settingsSource.repository.includes('/api/account-finance'),
  'billing screen shows Pagero and CallTag together': settingsSource.billing.includes('페이지로') && settingsSource.billing.includes('콜태그'),
  'referral screen exposes copy and apply actions': settingsSource.referral.includes('코드 복사') && settingsSource.referral.includes('추천인 코드 등록'),
  'referral screen states unified owner ledger': settingsSource.referral.includes('동일한 계정 원장으로 합산'),
};

const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? 'ok' : 'failed'} - ${name}`);
}
if (failed.length) {
  throw new Error(`Billing/referral quality checks failed: ${failed.join(', ')}`);
}

console.log(JSON.stringify({ ok: true, checks: Object.keys(checks).length }, null, 2));
