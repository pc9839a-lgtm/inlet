import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const files = {
  shared: 'functions/api/billing/_shared.js',
  commissions: 'functions/api/billing/_commissions.js',
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
  signupReferral: 'functions/api/referrals/_signup.js',
  register: 'functions/api/auth/register.js',
  migration: 'migrations/0009_unified_billing_referral.sql',
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
  referral: await readFile(path.join(root, 'src/panels/settings/ReferralSettingsSection.jsx'), 'utf8'),
  partner: await readFile(path.join(root, 'src/panels/settings/PartnerSettingsSection.jsx'), 'utf8'),
  settlement: await readFile(path.join(root, 'src/panels/settings/SettlementSettingsSection.jsx'), 'utf8'),
  financeHook: await readFile(path.join(root, 'src/panels/settings/useAccountFinance.js'), 'utf8'),
  pageBasic: await readFile(path.join(root, 'src/panels/settings/PageBasicSettingsSection.jsx'), 'utf8'),
  managerEmpty: await readFile(path.join(root, 'src/panels/settings/ManagerEmptyState.jsx'), 'utf8'),
  layout: await readFile(path.join(root, 'src/panels/SettingsPanel-final-policy-layout.css'), 'utf8'),
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
  'signup referral entitlement is promotional not paid': source.signupReferral.includes("'promotional'") && source.referralSummary.includes("verification_state = 'verified'"),
  'signup referral expires after seven days': source.signupReferral.includes('SIGNUP_CLASSIC_DAYS * DAY_MS') && source.signupReferral.includes('expiresIso'),
  'referral is validated before account creation': referralValidationIndex >= 0 && accountRegistrationIndex >= 0 && referralValidationIndex < accountRegistrationIndex,
  'signup endpoint applies referral once': source.register.includes('applySignupReferralCode') && source.migration.includes('referred_owner_id TEXT NOT NULL UNIQUE'),
  'self referral remains blocked': source.signupReferral.includes("'SELF_REFERRAL'") && source.migration.includes('CHECK(referrer_owner_id != referred_owner_id)'),
  'post signup referral API is disabled': source.referralApply.includes("'REFERRAL_SIGNUP_ONLY'") && !source.referralApply.includes('applyReferralCode'),
  'partner revenue uses one server ledger': source.migration.includes('partner_commissions') && source.commissions.includes('referrer_owner_id') && source.commissions.includes('referred_owner_id'),
  'commission rate is exactly twenty percent': source.commissions.includes('const COMMISSION_RATE_BPS = 2000') && source.commissions.includes('Math.floor(baseAmountKrw * COMMISSION_RATE_BPS / 10000)'),
  'commission writes are idempotent': source.migration.includes('UNIQUE(payment_reference)') && source.commissions.includes('INSERT OR IGNORE INTO partner_commissions'),
  'Pagero Classic commission base is 3500': source.commissions.includes('pagero_monthly: 3500'),
  'Pagero Pro commission base is 5500': source.commissions.includes('pagero_pro_monthly: 5500'),
  'CallTag integrated commission base is 6000': source.commissions.includes('all_monthly: 6000'),
  'Google Play verification records commission': source.verify.includes('recordReferralCommission') && source.verify.includes("channel: 'google_play'"),
  'Google Play restore records commission': source.restore.includes('recordReferralCommission') && source.restore.includes("channel: 'google_play'"),
  'web payment confirmation records commission': source.webConfirm.includes('recordReferralCommission') && source.webConfirm.includes("channel: 'web'"),
  'web payment confirmation requires provider token': source.webConfirm.includes('apiTokenAuthorized(request, env)'),
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
  'settings pricing keeps CallTag integrated 6000': ui.repository.includes("name: '통합권'") && ui.repository.includes("code: 'all_monthly'") && ui.repository.includes('amountKrw: 6000'),
  'Pagero checkout lists free Classic and Pro': ['무료', '클래식', '프로', '월 3,500원', '월 5,500원'].every((text) => ui.pageroCheckout.includes(text)),
  'CallTag checkout lists phone message and integrated plans': ['전화관리', '월 1,900원', '문자자동화', '월 990원', '통합권', '월 6,000원'].every((text) => ui.calltagCheckout.includes(text)) && !ui.calltagCheckout.includes('월 3,500원') && !ui.calltagCheckout.includes('월 5,500원'),
  'settings navigation separates referral partner settlement': ['추천인', '파트너', '정산'].every((text) => ui.navigation.includes(text)),
  'settings renders partner and settlement sections': ui.sections.includes('PartnerSettingsSection') && ui.sections.includes('SettlementSettingsSection'),
  'partner section exposes code copy and performance': ui.partner.includes('내 파트너 코드') && ui.partner.includes('복사') && ui.partner.includes('partner-metric-grid') && ui.partner.includes('20%'),
  'settlement section links exact CallTag settlement page': ui.settlement.includes('https://calltag.pagero.kr/web/settlement') && ui.settlement.includes('페이지로·콜태그 통합 정산'),
  'referral settings no longer accepts a code': ui.referral.includes('회원가입할 때 추천인 코드를 입력') && !ui.referral.includes('<input') && !ui.referral.includes('applyReferral'),
  'settings hook has no post signup referral action': !ui.financeHook.includes('applyAccountReferralCode') && !ui.financeHook.includes('applyReferral'),
  'signup form exposes optional referral code': ui.auth.includes('추천인 코드 <em>선택</em>') && ui.auth.includes('페이지로 클래식 7일 이용권'),
  'referral code hides Google signup path': ui.authReferralCss.includes(':has(.auth-referral-field input:not(:placeholder-shown)) .auth-google-btn') && ui.authReferralCss.includes('이메일 회원가입에서만 적용'),
  'page basic layout has dedicated full width hook': ui.pageBasic.includes('page-basic-settings-card') && ui.pageBasic.includes('page-basic-settings-grid'),
  'manager empty state keeps first add action': ui.managerEmpty.includes('첫 매니저 추가'),
  'final layout expands page basic controls': ui.layout.includes('.page-basic-settings-grid') && ui.layout.includes('grid-template-columns: repeat(2') && ui.layout.includes('height: 56px'),
  'final layout expands manager empty state full width': ui.layout.includes('.manager-empty-state.compact') && ui.layout.includes('grid-column: 1 / -1') && ui.layout.includes('min-width: 142px'),
  'final layout is imported after legacy settings CSS': ui.settingsPanel.indexOf("'./SettingsPanel.css'") < ui.settingsPanel.indexOf("'./SettingsPanel-final-policy-layout.css'"),
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
