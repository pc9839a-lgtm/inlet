import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const paths = {
  portal: 'functions/api/partner/_portal.js',
  dashboard: 'functions/api/partner/dashboard.js',
  referrals: 'functions/api/partner/referrals.js',
  earnings: 'functions/api/partner/earnings.js',
  finance: 'functions/api/billing/finance.js',
  repository: 'src/lib/accountFinanceRepository.js',
  partnerSettings: 'src/panels/settings/PartnerSettingsSection.jsx',
  settlementSettings: 'src/panels/settings/SettlementSettingsSection.jsx',
};

const source = {};
for (const [name, relative] of Object.entries(paths)) {
  source[name] = await readFile(path.join(root, relative), 'utf8');
}

for (const relative of [
  paths.portal,
  paths.dashboard,
  paths.referrals,
  paths.earnings,
  paths.finance,
]) {
  await import(pathToFileURL(path.join(root, relative)).href);
}

const checks = {
  'partner portal prepares dedicated CallTag referral schema':
    source.portal.includes('ensureCallTagReferralSchema(env.DB)')
      && source.portal.includes("normalizeService(service) === 'CALLTAG' ? 'calltag_referrals' : 'referrals'"),
  'CallTag partner rate stays isolated and server controlled':
    source.portal.includes("if (normalizeService(service) === 'CALLTAG')")
      && source.portal.includes('readCallTagReferralProgramConfig(db)')
      && source.portal.includes('program.commissionRatePercent'),
  'CallTag dashboard counts dedicated referral relationships':
    source.dashboard.includes('const referralTable = referralTableForService(service)')
      && source.dashboard.includes('FROM ${referralTable} r'),
  'CallTag referral list reads dedicated relationship table':
    source.referrals.includes('const referralTable = referralTableForService(service)')
      && source.referrals.includes('FROM ${referralTable} r'),
  'partner earnings expose refund recovery as signed reversed rows':
    source.earnings.includes('signedAmount(row.commission_amount_krw)')
      && source.earnings.includes("commission < 0")
      && source.earnings.includes("'REVERSED'"),
  'CallTag finance endpoint switches scope by product header':
    source.finance.includes("request.headers.get('X-Pagero-Product')")
      && source.finance.includes("const referralTable = isCallTag ? 'calltag_referrals' : 'referrals'")
      && source.finance.includes("s.product_code IN ('call_monthly','message_monthly','all_monthly')")
      && source.finance.includes("cs.product_code IN ('call_monthly','message_monthly','all_monthly')"),
  'CallTag finance base trial is server controlled with seven-day default':
    source.finance.includes('callTagProgram?.baseTrialDays || 7')
      && source.finance.includes('baseDays: Math.max(1, Number(baseTrialDays || 3))'),
  'CallTag finance returns server-controlled scoped partner-center link':
    source.finance.includes("scope: isCallTag ? 'calltag' : 'legacy'")
      && source.finance.includes('callTagProgram?.partnerCenterUrl'),
  'CallTag web host sends product scoping header':
    source.repository.includes("headers['X-Pagero-Product'] = 'calltag'")
      && source.repository.includes("host === 'calltag.pagero.kr'"),
  'finance cache is isolated by service scope':
    source.repository.includes("return account && session ? `${scope}:${account}:${session.slice(-24)}` : ''"),
  'CallTag settings route to scoped settlement center':
    source.partnerSettings.includes('https://pagero.kr/partner?service=CALLTAG')
      && source.settlementSettings.includes('https://pagero.kr/partner?service=CALLTAG'),
  'CallTag settlement labels no longer force unified wording':
    source.settlementSettings.includes("calltagScoped ? '콜태그 추천수익' : '페이지로 · 콜태그'")
      && source.settlementSettings.includes("calltagScoped ? '콜태그 정산' : '통합 정산'"),
};

const failed = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? 'ok' : 'failed'} - ${name}`);
}

if (failed.length) {
  throw new Error(`CallTag partner scope checks failed: ${failed.join(', ')}`);
}

console.log(JSON.stringify({ ok: true, checks: Object.keys(checks).length }, null, 2));
