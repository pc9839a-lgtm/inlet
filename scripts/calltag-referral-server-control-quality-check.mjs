import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const paths = {
  program: 'functions/api/referrals/_calltag-program.js',
  signup: 'functions/api/referrals/_calltag-signup.js',
  trial: 'functions/api/billing/trial-policy.js',
  commissions: 'functions/api/billing/_commissions.js',
  summary: 'functions/api/referrals/summary.js',
  finance: 'functions/api/billing/finance.js',
  portal: 'functions/api/partner/_portal.js',
  admin: 'functions/api/call/admin/referral-program.js',
};

const source = {};
for (const [key, relative] of Object.entries(paths)) {
  source[key] = await readFile(path.join(root, relative), 'utf8');
}

for (const relative of Object.values(paths)) {
  await import(pathToFileURL(path.join(root, relative)).href);
}

const checks = {
  'server owns referral program configuration':
    source.program.includes('CREATE TABLE IF NOT EXISTS calltag_referral_program_config')
      && source.program.includes('commission_rate_bps')
      && source.program.includes('invitee_bonus_days')
      && source.program.includes('minimum_payout_krw'),
  'default behavior stays at twenty percent and five bonus days':
    source.program.includes('commissionRateBps: 2000')
      && source.program.includes('inviteeBonusDays: 5')
      && source.program.includes('baseTrialDays: 7'),
  'new referral signup can be paused without app release':
    source.signup.includes('readCallTagReferralProgramConfig')
      && source.signup.includes('REFERRAL_PROGRAM_PAUSED')
      && source.signup.includes('program.inviteeBonusDays'),
  'existing referral bonus is stored per relationship and not rewritten globally':
    source.trial.includes('Number(referral.bonus_days || 0)')
      && !source.trial.includes('SET bonus_days = ?'),
  'recurring commission rate can be changed or paused server-side':
    source.commissions.includes('readCallTagReferralProgramConfig')
      && source.commissions.includes('CALLTAG_COMMISSION_PAUSED')
      && source.commissions.includes('resolveCallTagCommissionRateBps(callTagProgram)'),
  'client summary exposes runtime program fields through existing endpoint':
    source.summary.includes('programEnabled: program.enabled')
      && source.summary.includes('commissionRatePercent: program.commissionRatePercent')
      && source.summary.includes('friendBonusDays: program.inviteeBonusDays')
      && source.summary.includes('shareMessage: renderCallTagReferralProgramText')
      && source.summary.includes('pausedMessage: renderCallTagReferralProgramText'),
  'web finance uses the same runtime config':
    source.finance.includes('readCallTagReferralProgramConfig')
      && source.finance.includes('minimumPayoutKrw')
      && source.finance.includes('commissionRatePercent'),
  'CallTag payout threshold is server controlled':
    source.portal.includes('minimumPayoutKrw')
      && source.portal.includes('readCallTagReferralProgramConfig'),
  'admin config changes are finance-admin protected and audited':
    source.admin.includes('requireCalltagFinanceAdmin')
      && source.admin.includes("'referral.program.update'")
      && source.admin.includes('recordAdminAudit'),
  'partner center remains independently available when acquisition is paused':
    source.summary.includes('partnerCenterAvailable: program.partnerCenterEnabled')
      && !source.summary.includes('program.enabled && program.partnerCenterEnabled'),
};

const failed = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? 'ok' : 'failed'} - ${name}`);
}

if (failed.length) {
  throw new Error(`CallTag referral server-control checks failed: ${failed.join(', ')}`);
}

console.log(JSON.stringify({ ok: true, checks: Object.keys(checks).length }, null, 2));
