import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = {
  api: await readFile('functions/api/account-finance.js', 'utf8'),
  calltagAlias: await readFile('functions/api/calltag/finance.js', 'utf8'),
  pageroAlias: await readFile('functions/api/pagero/finance.js', 'utf8'),
  migration: await readFile('migrations/0011_unified_account_finance.sql', 'utf8'),
  settingsBody: await readFile('src/panels/settings/SettingsPanelBody.jsx', 'utf8'),
  primarySections: await readFile('src/panels/settings/SettingsPrimarySections.jsx', 'utf8'),
  billing: await readFile('src/panels/settings/BillingSettingsSection.jsx', 'utf8'),
  referral: await readFile('src/panels/settings/ReferralSettingsSection.jsx', 'utf8'),
  client: await readFile('src/lib/accountFinanceRepository.js', 'utf8'),
};

for (const table of [
  'account_finance_profiles',
  'account_subscriptions',
  'account_referrals',
  'account_finance_ledger',
]) {
  assert(files.migration.includes(table), `migration must create ${table}`);
  assert(files.api.includes(table), `runtime schema must include ${table}`);
}

assert(files.api.includes("commission_rate_bps INTEGER NOT NULL DEFAULT 2000"), 'commission rate must remain 20%');
assert(files.api.includes("bonus_days INTEGER NOT NULL DEFAULT 5"), 'referral bonus must remain 5 days');
assert(files.api.includes("action === 'record-charge'"), 'payment provider charge action must exist');
assert(files.api.includes("service, entry_type, amount_krw"), 'ledger must keep service-level entries');
assert(files.api.includes("'combined', 'payout'"), 'combined payout record must exist');
assert(files.api.includes("pagero: '/subscribe?service=pagero'"), 'Pagero checkout fallback must exist');
assert(files.api.includes("calltag: 'https://calltag.pagero.kr/subscribe'"), 'CallTag checkout fallback must exist');
assert.equal(files.calltagAlias.trim(), "export { onRequest } from '../account-finance.js';", 'CallTag must use shared finance API');
assert.equal(files.pageroAlias.trim(), "export { onRequest } from '../account-finance.js';", 'Pagero must use shared finance API');

for (const token of ['요금제·결제', '추천인', 'SERVICE_NAV']) {
  assert(files.settingsBody.includes(token), `settings navigation missing ${token}`);
}
for (const component of ['BillingSettingsSection', 'ReferralSettingsSection']) {
  assert(files.primarySections.includes(component), `settings renderer missing ${component}`);
}
assert(files.billing.includes('페이지로') && files.billing.includes('콜태그'), 'billing UI must show both services');
assert(files.billing.includes('통합 정산'), 'billing UI must show combined settlement');
assert(files.referral.includes('코드 복사'), 'referral UI must support code copy');
assert(files.referral.includes('추천인 코드 등록'), 'referral UI must support code registration');
assert(files.client.includes("'/api/account-finance'"), 'web settings must read the shared finance endpoint');

console.log('Account finance QA passed: shared billing, referral, and combined settlement contracts are present.');
