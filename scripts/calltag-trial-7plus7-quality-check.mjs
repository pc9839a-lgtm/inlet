import { readFile } from 'node:fs/promises';

const files = {
  policy: await readFile('functions/api/billing/trial-policy.js', 'utf8'),
  entitlements: await readFile('functions/api/billing/entitlements.js', 'utf8'),
  pageroSignupReferral: await readFile('functions/api/referrals/_signup.js', 'utf8'),
  calltagSignupReferral: await readFile('functions/api/referrals/_calltag-signup.js', 'utf8'),
  callRegister: await readFile('functions/api/call/register.js', 'utf8'),
  authRegister: await readFile('functions/api/auth/register.js', 'utf8'),
  postSignupApply: await readFile('functions/api/referrals/apply.js', 'utf8'),
};

const checks = {
  'CallTag base trial is seven days': files.policy.includes('CALLTAG_BASE_TRIAL_DAYS = 7'),
  'CallTag referral bonus is seven days': files.policy.includes('CALLTAG_REFERRAL_BONUS_DAYS = 7'),
  'CallTag referral total is fourteen days': files.policy.includes('CALLTAG_REFERRAL_TOTAL_DAYS = 14'),
  'CallTag referral trial scope is all in one': files.policy.includes("scope: 'all'") && files.calltagSignupReferral.includes("productCode: 'all_monthly'"),
  'billing endpoint scopes CallTag policy by product header': files.entitlements.includes("productClient === 'calltag'") && files.entitlements.includes('resolveCallTagEntitlement'),
  'CallTag app signup validates referral before account creation': files.callRegister.indexOf('validateSignupReferralCode') >= 0 && files.callRegister.indexOf('validateSignupReferralCode') < files.callRegister.indexOf('registerAccount({'),
  'CallTag app signup applies CallTag-specific referral only during signup': files.callRegister.includes('applyCallTagSignupReferralCode') && files.callRegister.includes('referralCode'),
  'post signup referral endpoint stays blocked': files.postSignupApply.includes('REFERRAL_SIGNUP_ONLY'),
  'PageRo signup referral keeps its Classic seven day policy': files.pageroSignupReferral.includes('SIGNUP_CLASSIC_DAYS = 7') && files.pageroSignupReferral.includes("productCode: 'pagero_monthly'") && files.pageroSignupReferral.includes("'promotional'"),
  'PageRo generic signup is not rewritten to CallTag trial policy': !files.authRegister.includes('enforceCallTagTrialPolicy') && files.authRegister.includes('applySignupReferralCode'),
  'CallTag referral does not create PageRo promotional subscription': !files.calltagSignupReferral.includes("'pagero_monthly'") && !files.calltagSignupReferral.includes("'promotional'"),
};

const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? 'ok' : 'failed'} - ${name}`);
}
if (failed.length) throw new Error(`CallTag trial checks failed: ${failed.join(', ')}`);
console.log(JSON.stringify({ ok: true, checks: Object.keys(checks).length }, null, 2));
