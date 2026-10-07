import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const files = {
  shared: 'functions/api/billing/_shared.js',
  commissions: 'functions/api/billing/_commissions.js',
  partnerFinance: 'functions/api/billing/_partnerFinance.js',
  readiness: 'functions/api/billing/_readiness.js',
  entitlements: 'functions/api/billing/entitlements.js',
  subscriptions: 'functions/api/billing/subscriptions.js',
  billingReadiness: 'functions/api/billing/readiness.js',
  webPrecheck: 'functions/api/billing/web/precheck.js',
  webConfirm: 'functions/api/billing/web/confirm.js',
  verify: 'functions/api/billing/google/verify.js',
  restore: 'functions/api/billing/google/restore.js',
  referralMe: 'functions/api/referrals/me.js',
  referralApply: 'functions/api/referrals/apply.js',
  referralSummary: 'functions/api/referrals/summary.js',
  calltagLedger: 'functions/api/referrals/_calltag-ledger.js',
  calltagSignupReferral: 'functions/api/referrals/_calltag-signup.js',
  calltagTrialPolicy: 'functions/api/billing/trial-policy.js',
  finance: 'functions/api/billing/finance.js',
  rtdn: 'functions/api/billing/google/rtdn.js',
  signupReferral: 'functions/api/referrals/_signup.js',
  register: 'functions/api/auth/register.js',
  migration: 'migrations/0009_unified_billing_referral.sql',
  calltagMigration: 'migrations/0017_calltag_referral_cash_isolation.sql',
};

const source = {};
for (const [name, relative] of Object.entries(files)) {
  source[name] = await readFile(path.join(root, relative), 'utf8');
}

for (const relative of Object.values(files).filter((item) => item.endsWith('.js'))) {
  await import(pathToFileURL(path.join(root, relative)).href);
}

const ui = {
  navigation: await readFile(path.join(root, 'src/panels/settings/SettingsPanelBody.jsx'), 'utf8'),
  sections: await readFile(path.join(root, 'src/panels/settings/SettingsPrimarySections.jsx'), 'utf8'),
  repository: await readFile(path.join(root, 'src/lib/accountFinanceRepository.js'), 'utf8'),
  billing: await readFile(path.join(root, 'src/panels/settings/BillingSettingsSection.jsx'), 'utf8'),
  customDomain: await readFile(path.join(root, 'src/panels/settings/CustomDomainSettingsSection.jsx'), 'utf8'),
  referral: await readFile(path.join(root, 'src/panels/settings/ReferralSettingsSection.jsx'), 'utf8'),
  partner: await readFile(path.join(root, 'src/panels/settings/PartnerSettingsSection.jsx'), 'utf8'),
  settlement: await readFile(path.join(root, 'src/panels/settings/SettlementSettingsSection.jsx'), 'utf8'),
  financeHook: await readFile(path.join(root, 'src/panels/settings/useAccountFinance.js'), 'utf8'),
  pageBasic: await readFile(path.join(root, 'src/panels/settings/PageBasicSettingsSection.jsx'), 'utf8'),
  managerEmpty: await readFile(path.join(root, 'src/panels/settings/ManagerEmptyState.jsx'), 'utf8'),
  managerSettings: await readFile(path.join(root, 'src/panels/settings/ManagerSettingsSection.jsx'), 'utf8'),
  settingsPanel: await readFile(path.join(root, 'src/panels/SettingsPanel.jsx'), 'utf8'),
  auth: await readFile(path.join(root, 'src/screens/AuthScreen.jsx'), 'utf8'),
  authReferralCss: await readFile(path.join(root, 'src/screens/AuthReferral.css'), 'utf8'),
  pageroCheckout: await readFile(path.join(root, 'public/subscribe/index.html'), 'utf8'),
  calltagCheckout: await readFile(path.join(root, 'public/call/subscribe/index.html'), 'utf8'),
};

const verifyGateIndex = source.verify.indexOf('assertGooglePlayBillingReady(env);');
const verifyActionIndex = source.verify.indexOf('const entitlement = await verifyGoogleSubscription');
const restoreGateIndex = source.restore.indexOf('assertGooglePlayBillingReady(env);');
const restoreActionIndex = source.restore.indexOf('const entitlement = await restoreGoogleSubscriptions');
const referralValidationIndex = source.register.indexOf('validateSignupReferralCode');
const accountRegistrationIndex = source.register.indexOf('registerAccount(registration');

const checks = {
  'base trial remains three days for Pagero generic billing': source.shared.includes('const TRIAL_BASE_DAYS = 3'),
  'signup referral classic pass is exactly seven days': source.signupReferral.includes('const SIGNUP_CLASSIC_DAYS = 7'),
  'signup referral creates Pagero Classic entitlement': source.signupReferral.includes("'pagero_monthly'") && source.signupReferral.includes("channel, 'referral'") === false && source.signupReferral.includes("'referral', 'active'"),
  'signup referral entitlement is promotional not paid': source.signupReferral.includes("'promotional'") && source.calltagLedger.includes("verification_state = 'verified'"),
  'signup referral expires after seven days': source.signupReferral.includes('SIGNUP_CLASSIC_DAYS * DAY_MS') && source.signupReferral.includes('expiresIso'),
  'referral is validated before account creation': referralValidationIndex >= 0 && accountRegistrationIndex >= 0 && referralValidationIndex < accountRegistrationIndex,
  'signup endpoint applies referral once': source.register.includes('applySignupReferralCode') && source.migration.includes('referred_owner_id TEXT NOT NULL UNIQUE'),
  'self referral remains blocked': source.signupReferral.includes("'SELF_REFERRAL'") && source.migration.includes('CHECK(referrer_owner_id != referred_owner_id)'),
  'post signup referral API is disabled': source.referralApply.includes("'REFERRAL_SIGNUP_ONLY'") && !source.referralApply.includes('applyReferralCode'),
  'partner revenue uses one server ledger': source.migration.includes('partner_commissions') && source.commissions.includes('referrer_owner_id') && source.commissions.includes('referred_owner_id'),
  'commission defaults to twenty percent and supports controlled fifty percent': source.partnerFinance.includes('const ALLOWED_RATE_BPS = new Set([2000, 5000])') && source.partnerFinance.includes('commission_rate_bps INTEGER NOT NULL DEFAULT 2000') && source.commissions.includes('resolvePartnerCommissionRateBps') && source.commissions.includes('Math.floor(baseAmountKrw * commissionRateBps / 10000)'),
  'CallTag referral cash commission is fixed at twenty percent': source.commissions.includes("CALLTAG_CASH_COMMISSION_PRODUCTS") && source.commissions.includes("CALLTAG_COMMISSION_RATE_BPS = 2000") && !source.commissions.includes('CALLTAG_REFERRAL_TIME_REWARD_ONLY'),
  'CallTag referral relation is isolated from PageRo': source.calltagLedger.includes('CREATE TABLE IF NOT EXISTS calltag_referrals') && source.calltagSignupReferral.includes('INSERT INTO calltag_referrals') && source.calltagTrialPolicy.includes('callTagReferralForReferred'),
  'CallTag paid conversion counts only CallTag products': source.calltagLedger.includes("s.product_code IN ('call_monthly', 'message_monthly', 'all_monthly')"),
  'CallTag revenue summary uses a dedicated commission ledger': source.calltagLedger.includes('FROM calltag_partner_commissions') && source.referralSummary.includes('callTagReferralSummary'),
  'CallTag commission ledger is isolated from PageRo': source.calltagMigration.includes('CREATE TABLE IF NOT EXISTS calltag_partner_commissions') && source.commissions.includes('INSERT OR IGNORE INTO calltag_partner_commissions') && source.commissions.includes('product_code'),
  'commission writes are idempotent': source.migration.includes('UNIQUE(payment_reference)') && source.commissions.includes('INSERT OR IGNORE INTO partner_commissions'),
  'Pagero Classic commission base is 3500': source.commissions.includes('pagero_monthly: 3500'),
  'Pagero Pro commission base is 5500': source.commissions.includes('pagero_pro_monthly: 5500'),
  'CallTag integrated commission base is 6000': source.commissions.includes('all_monthly: 6000'),
  'Google Play verification reconciles commission': source.verify.includes('reconcileCallTagReferralCommission') && source.verify.includes("channel: 'google_play'"),
  'Google Play restore reconciles commission': source.restore.includes('reconcileCallTagReferralCommission') && source.restore.includes("channel: 'google_play'"),
  'Google Play commission uses verified net customer payment': source.shared.includes('googlePlayOrderNetPaidKrw') && source.shared.includes('partialRefundEvents') && source.shared.includes('PROCESSED_SUCCESSFULLY') && source.verify.includes('baseAmountKrw: netPaidKrw') && source.restore.includes('baseAmountKrw: netPaidKrw'),
  'Google Play renewal order uses latest successful order id': source.shared.includes('matched?.latestSuccessfulOrderId'),
  'Google Play refund reconciliation is settlement safe': source.commissions.includes('reconcileCallTagReferralCommission') && source.commissions.includes('callTagCommissionSettlementLock') && source.commissions.includes('deltaCommissionKrw') && source.verify.includes('googlePlayOrderIsRefundPending') && source.restore.includes('googlePlayOrderIsRefundPending'),
  'Google Play RTDN handles renewals and voided purchases': source.rtdn.includes('subscriptionNotification') && source.rtdn.includes('voidedPurchaseNotification') && source.rtdn.includes('reconcileCallTagReferralCommission') && source.rtdn.includes('cancelReferralCommission'),
  'Google Play RTDN is secret protected': source.rtdn.includes('GOOGLE_PLAY_RTDN_SECRET') && source.rtdn.includes('RTDN_AUTH_INVALID'),
  'web payment confirmation records commission': source.webConfirm.includes('recordReferralCommission') && source.webConfirm.includes("channel: 'web'"),
  'web payment confirmation requires billing-specific provider gate': source.webConfirm.includes('assertWebBillingProvider(request, env)') && source.webConfirm.includes('assertWebBillingChargingReady(env)'),
  'Pagero and CallTag checkout conflicts are service scoped': source.webPrecheck.includes('sameServiceProduct') && source.webPrecheck.includes('PAGERO_PRODUCTS') && source.webPrecheck.includes('CALLTAG_PRODUCTS'),
  'Pagero referral pass does not block CallTag checkout': source.webPrecheck.includes("active.channel === 'referral'") && source.webPrecheck.includes('sameServiceProduct(productCode'),
  'Play conflict only applies to CallTag checkout': source.webConfirm.includes('if (CALLTAG_PRODUCTS.has(productCode))'),
  'raw Google purchase token is not stored': source.migration.includes('purchase_token_hash') && !source.migration.includes('purchase_token TEXT'),
  'Google Play package is fixed': source.shared.includes("packageName !== 'kr.pagero.calltag'"),
  'Google Play uses Android Publisher API': source.shared.includes('androidpublisher.googleapis.com/androidpublisher/v3/applications/'),
  'Google Play requests block redirects': source.shared.includes("redirect: 'error'"),
  'Google Play requests have timeouts': source.shared.includes('AbortSignal.timeout(15000)'),
  'verify is blocked before publisher verification': verifyGateIndex >= 0 && verifyActionIndex >= 0 && verifyGateIndex < verifyActionIndex,
  'restore is blocked before publisher verification': restoreGateIndex >= 0 && restoreActionIndex >= 0 && restoreGateIndex < restoreActionIndex,
  'settings pricing has Pagero free': ui.repository.includes("code: 'pagero_free'") && ui.repository.includes('amountKrw: 0'),
  'settings pricing has Pagero Classic 3500': ui.repository.includes("code: 'pagero_monthly'") && ui.repository.includes('amountKrw: 3500'),
  'settings pricing has Pagero Pro 5500': ui.repository.includes("code: 'pagero_pro_monthly'") && ui.repository.includes('amountKrw: 5500'),
  'Pagero pricing does not invent plan entitlements before owner approval': !ui.repository.includes("description: '페이지 운영과 고객 접수 관리'") && !ui.repository.includes('HTTPS/SSL 관리 포함') && !ui.billing.includes('무료 기능 전체') && !ui.billing.includes('클래식 기능 전체'),
  'settings pricing keeps CallTag integrated 6000': ui.repository.includes("name: '통합권'") && ui.repository.includes("code: 'all_monthly'") && ui.repository.includes('amountKrw: 6000'),
  'CallTag integrated subscription does not grant Pagero Classic implicitly': !ui.repository.includes('includedClassicByBundle') && !ui.repository.includes("bundleIncludes: ['pagero_monthly'"),
  'Pagero checkout lists only approved free Classic and Pro choices': ['무료', '클래식', '프로', '월 3,500원', '월 5,500원'].every((text) => ui.pageroCheckout.includes(text)) && !ui.pageroCheckout.includes('pagero_domain_monthly') && !ui.pageroCheckout.includes('월 1,000원'),
  'Pagero checkout remains inquiry only while web auto billing is not live': ui.billing.includes('billing-settings-status') && ui.billing.includes('<span>자동결제</span><strong>준비 중</strong>') && ui.billing.includes("paid ? '가입 문의' : '기본'") && ui.pageroCheckout.includes('가입 문의'),
  'Pagero custom domain uses server lifecycle without an unapproved SSL billing product': ui.customDomain.includes('checkPageDomain') && ui.customDomain.includes('verifyPageDomain') && ui.customDomain.includes('detachPageDomain') && !ui.customDomain.includes('DOMAIN_PRODUCT') && !ui.customDomain.includes('도입 문의') && !ui.repository.includes('pagero_domain_monthly') && !source.webPrecheck.includes('pagero_domain_monthly') && !source.webConfirm.includes('pagero_domain_monthly'),
  'CallTag checkout lists phone message and integrated plans': ['전화관리', '월 1,900원', '문자자동화', '월 990원', '통합권', '월 6,000원'].every((text) => ui.calltagCheckout.includes(text)) && !ui.calltagCheckout.includes('월 3,500원') && !ui.calltagCheckout.includes('월 5,500원'),
  'settings navigation separates referral partner settlement': ['추천인', '파트너', '정산'].every((text) => ui.navigation.includes(text)),
  'settings renders partner and settlement sections': ui.sections.includes('PartnerSettingsSection') && ui.sections.includes('SettlementSettingsSection'),
  'partner section exposes code copy and performance': ui.partner.includes('파트너 코드') && ui.partner.includes('copyPartnerCode') && ui.partner.includes('추천 가입') && ui.partner.includes('유료 전환') && ui.partner.includes('20%'),
  'settlement section links exact CallTag settlement page': ui.settlement.includes("const SETTLEMENT_URL = 'https://calltag.pagero.kr/web/settlement'") && ui.settlement.includes('통합 정산'),
  'referral settings remains signup only': ui.referral.includes('회원가입 시 1회') && ui.referral.includes('클래식 7일') && !ui.referral.includes('<input') && !ui.referral.includes('applyReferral'),
  'settings hook has no post signup referral action': !ui.financeHook.includes('applyAccountReferralCode') && !ui.financeHook.includes('applyReferral'),
  'signup form exposes optional referral code': ui.auth.includes('추천인 코드 <em>선택</em>') && ui.auth.includes('auth-referral-field') && source.signupReferral.includes('const SIGNUP_CLASSIC_DAYS = 7'),
  'referral code hides Google signup path': ui.authReferralCss.includes(':has(.auth-referral-field input:not(:placeholder-shown)) .auth-google-btn') && ui.authReferralCss.includes('이메일 회원가입에서만 적용'),
  'page basic layout has dedicated full width hook': ui.pageBasic.includes('page-basic-settings-card') && ui.pageBasic.includes('page-basic-settings-grid'),
  'manager section always exposes add action while empty state stays minimal': ui.managerSettings.includes('onClick={addManager}') && ui.managerSettings.includes('>추가</button>') && ui.managerEmpty.includes('매니저 없음'),
  'settings panel delegates to split body architecture': ui.settingsPanel.includes("SettingsPanelBody from './settings/SettingsPanelBody.jsx'") && ui.settingsPanel.includes('<SettingsPanelBody'),
  'settings body keeps current flat navigation shell': ui.navigation.includes('settings-v3-root settings-v4-flat') && ui.navigation.includes('settings-v3-sidebar') && ui.navigation.includes('settings-v3-main'),
  'CallTag finance API uses seven day policy and scoped summary': source.finance.includes("productClient === 'calltag'") && source.finance.includes('resolveCallTagEntitlement') && source.finance.includes('callTagReferralSummary'),
  'settings use consolidated finance API': ui.repository.includes("'/api/billing/finance'") && ui.repository.includes('normalizeFinance'),
  'no parallel finance API was introduced': !ui.repository.includes('/api/account-finance'),
};

const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? 'ok' : 'failed'} - ${name}`);
}
if (failed.length) {
  throw new Error(`Billing/referral quality checks failed: ${failed.join(', ')}`);
}

console.log(JSON.stringify({ ok: true, checks: Object.keys(checks).length }, null, 2));
