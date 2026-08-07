import { readFile } from 'node:fs/promises';

const files = {
  policy: await readFile('functions/api/billing/trial-policy.js', 'utf8'),
  entitlements: await readFile('functions/api/billing/entitlements.js', 'utf8'),
  signupReferral: await readFile('functions/api/referrals/_signup.js', 'utf8'),
  callRegister: await readFile('functions/api/call/register.js', 'utf8'),
  authRegister: await readFile('functions/api/auth/register.js', 'utf8'),
  postSignupApply: await readFile('functions/api/referrals/apply.js', 'utf8'),
};

const checks = {
  'base trial is seven days': files.policy.includes('CALLTAG_BASE_TRIAL_DAYS = 7'),
  'referral bonus is seven days': files.policy.includes('CALLTAG_REFERRAL_BONUS_DAYS = 7'),
  'referral total is fourteen days': files.policy.includes('CALLTAG_REFERRAL_TOTAL_DAYS = 14'),
  'trial scope is all in one': files.policy.includes("scope: 'all'") && files.signupReferral.includes("productCode: 'all_monthly'"),
  'billing entitlement uses CallTag trial policy': files.entitlements.includes('resolveCallTagEntitlement'),
  'CallTag app signup validates referral before account creation': files.callRegister.indexOf('validateSignupReferralCode') < files.callRegister.indexOf('registerAccount({'),
  'CallTag app signup applies referral only during signup': files.callRegister.includes('applySignupReferralCode') && files.callRegister.includes('referralCode'),
  'unified signup also applies base trial policy': files.authRegister.includes('enforceCallTagTrialPolicy'),
  'post signup referral endpoint stays blocked': files.postSignupApply.includes('REFERRAL_SIGNUP_ONLY'),
  'old Pagero-only referral promotional subscription is gone': !files.signupReferral.includes("productCode: 'pagero_monthly'") && !files.signupReferral.includes("'promotional'"),
};

const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? 'ok' : 'failed'} - ${name}`);
}
if (failed.length) throw new Error(`CallTag trial checks failed: ${failed.join(', ')}`);
console.log(JSON.stringify({ ok: true, checks: Object.keys(checks).length }, null, 2));
