import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browserSource = await readFile('scripts/form-reservation-browser-regression-check.mjs', 'utf8');
const authSessionSource = await readFile('scripts/form-browser-auth-session.mjs', 'utf8');
const workflowSource = await readFile('.github/workflows/qa.yml', 'utf8');
const qaAllSource = await readFile('scripts/qa-all.mjs', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const leadApiSource = await readFile('functions/api/leads.js', 'utf8');
const duplicatePanelSource = await readFile('src/panels/inbox/DuplicatePolicyPanel.jsx', 'utf8');
const formBlocksSource = await readFile('src/preview/renderers/FormBlocks.jsx', 'utf8');
const { normalizeDuplicateSettings } = await import('../functions/api/leads.js');

const defaultDuplicateSettings = normalizeDuplicateSettings({});
const legacyImplicitCookieSettings = normalizeDuplicateSettings({ leadDuplicateSettings: { rejectCookieDuplicate: true } });
const explicitCookieSettings = normalizeDuplicateSettings({
  leadDuplicateSettings: {
    rejectCookieDuplicate: true,
    cookieDuplicatePolicyExplicit: true,
    duplicatePolicyVersion: 2,
  },
});

assert(packageJson.scripts?.['browser:forms:qa'] === 'node --import ./scripts/form-browser-auth-session.mjs scripts/form-reservation-browser-regression-check.mjs', 'browser:forms:qa must preload the fake CI session');
assert(packageJson.scripts?.['browser:forms:contract:qa'] === 'node scripts/form-reservation-browser-regression-contract-check.mjs', 'browser:forms:contract:qa script is missing');
assert(qaAllSource.includes("['browser:forms:contract:qa', ['scripts/form-reservation-browser-regression-contract-check.mjs']]"), 'qa:all must enforce form browser contract QA');
assert(authSessionSource.includes("localStorage.setItem('inlet-auth-v1'") && authSessionSource.includes('form-e2e-session'), 'inbox reflection must use a CI-only authenticated session');

assert(workflowSource.includes('form-browser-regression:'), 'QA workflow must contain a form browser regression job');
assert(workflowSource.includes('VITE_INLET_PAGE_MODE: server') && workflowSource.includes('VITE_INLET_LEAD_MODE: server'), 'form browser build must run in server mode');
assert(workflowSource.includes('INLET_FORM_BROWSER_QA_ORIGIN: http://127.0.0.1:4175'), 'form browser origin must use the isolated preview port');
assert(workflowSource.includes('npm run browser:forms:qa'), 'form browser job must execute browser:forms:qa');
assert(workflowSource.includes('.tmp-form-browser-regression'), 'form browser screenshots must be uploaded');

assert(browserSource.includes("#block-consult-form") && browserSource.includes("#block-reserve-form"), 'browser QA must render consultation and reservation forms');
assert(browserSource.includes("await wait(400)") && browserSource.includes('submitRapidly'), 'lead API latency and rapid repeated clicks must be tested');
assert(browserSource.includes("state.leadPosts === 1") && browserSource.includes("state.leadPosts === 2"), 'consultation and reservation must create exactly one request each');
assert(browserSource.includes("이미 접수된 연락처") && browserSource.includes('must not reach the lead API'), 'duplicate contact submissions must be blocked before API persistence');
assert(browserSource.includes("type === '상담신청'") && browserSource.includes("type === '방문예약'"), 'lead types must be validated');
assert(browserSource.includes("values?.예약일") && browserSource.includes("values?.예약시간"), 'reservation date and time must be validated');
assert(browserSource.includes(".inbox-panel") && browserSource.includes(".lead-card-service"), 'submitted leads must be verified in the real inbox UI');
assert(browserSource.includes("bodyScrollWidth <= inboxMetrics.innerWidth + 3"), 'inbox browser check must reject horizontal overflow');
assert(browserSource.includes("state.unexpectedApis.length === 0") && browserSource.includes("browserErrors.length === 0"), 'browser QA must fail on unexpected APIs and browser exceptions');
assert(!browserSource.includes('pagero.kr/api/leads') && !browserSource.includes('productionPassword'), 'form browser QA must not use production data or credentials');
assert(defaultDuplicateSettings.rejectCookieDuplicate === false, 'cookie duplicate blocking must default to off');
assert(legacyImplicitCookieSettings.rejectCookieDuplicate === false, 'legacy implicit cookie blocking must migrate to off');
assert(explicitCookieSettings.rejectCookieDuplicate === true, 'an explicit cookie duplicate toggle must remain enabled');
assert(leadApiSource.includes("contactDuplicate ? 409 : 429") && leadApiSource.includes("code: contactDuplicate ? 'LEAD_DUPLICATE' : 'LEAD_RATE_LIMITED'"), 'lead API must distinguish duplicates from throttling');
assert(duplicatePanelSource.includes('cookieDuplicatePolicyExplicit: true') && duplicatePanelSource.includes('duplicatePolicyVersion: 2'), 'inbox policy toggle must persist an explicit cookie setting');
assert(formBlocksSource.includes('status === 409') && formBlocksSource.includes('status === 429') && !formBlocksSource.includes("[409, 429].includes"), 'public form must show separate duplicate and rate-limit messages');

console.log(JSON.stringify({
  ok: true,
  scope: 'form-reservation-browser-contract',
  flows: ['consultation', 'unique-contact-default', 'consultation-duplicate', 'reservation', 'reservation-duplicate', 'inbox-reflection'],
  productionData: false,
  ciAuthenticatedSession: true,
}, null, 2));
