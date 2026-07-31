import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browserSource = await readFile('scripts/editor-browser-regression-check.mjs', 'utf8');
const workflowSource = await readFile('.github/workflows/qa.yml', 'utf8');
const qaAllSource = await readFile('scripts/qa-all.mjs', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

assert(packageJson.scripts?.['browser:editor:qa'] === 'node scripts/editor-browser-regression-check.mjs', 'browser:editor:qa script is missing');
assert(packageJson.scripts?.['browser:editor:contract:qa'] === 'node scripts/editor-browser-regression-contract-check.mjs', 'browser:editor:contract:qa script is missing');
assert(qaAllSource.includes("['browser:editor:contract:qa', ['scripts/editor-browser-regression-contract-check.mjs']]"), 'qa:all must enforce the editor browser contract');

assert(workflowSource.includes('editor-browser-regression:'), 'QA workflow must contain an authenticated editor browser job');
assert(workflowSource.includes('VITE_INLET_PAGE_MODE: server') && workflowSource.includes('VITE_INLET_LEAD_MODE: server'), 'editor browser build must run in server data mode');
assert(workflowSource.includes('INLET_EDITOR_BROWSER_QA_ORIGIN: http://127.0.0.1:4174'), 'editor browser origin must use the isolated preview port');
assert(workflowSource.includes('npm run browser:editor:qa'), 'editor browser job must execute browser:editor:qa');
assert(workflowSource.includes('.tmp-editor-browser-regression'), 'editor browser screenshots must be uploaded');
assert(workflowSource.includes('include-hidden-files: true'), 'hidden browser screenshot directories must be included');

assert(browserSource.includes("`${origin}/login`") && browserSource.includes("input[placeholder=\"email@example.com\"]"), 'browser QA must start from the real login screen');
assert(browserSource.includes("pathname === '/api/auth/login'") && browserSource.includes("pathname === '/api/auth/session'"), 'browser QA must mock login and session refresh APIs');
assert(browserSource.includes("pathname === '/api/projects'") && browserSource.includes(".service-landing-card"), 'browser QA must load and select a dashboard page');
assert(browserSource.includes("#editor-block-editor-hero") && browserSource.includes('브라우저 저장 검증 완료'), 'browser QA must edit a real block and verify live preview');
assert(browserSource.includes(".panel-actions .primary-btn") && browserSource.includes("Page.reload"), 'browser QA must save and verify the page after reload');
assert(browserSource.includes("publicVerifyCount") && browserSource.includes("saveCount === 0"), 'browser QA must verify explicit save and public verification behavior');
assert(browserSource.includes("{ name: 'mobile-360', width: 360") && browserSource.includes("{ name: 'mobile-390', width: 390") && browserSource.includes("{ name: 'mobile-430', width: 430"), 'browser QA must cover 360, 390, and 430 pixel mobile widths');
assert(browserSource.includes("mobile-operations-shell") && browserSource.includes("bodyScrollWidth <= viewport.width + 3"), 'mobile editor regression must reject overflow and verify operations mode');
assert(browserSource.includes("unexpectedApis.length === 0") && browserSource.includes("browserErrors.length === 0"), 'browser QA must fail on unexpected API calls or browser exceptions');
assert(!browserSource.includes('pagero.kr/api/auth/login') && !browserSource.includes('productionPassword'), 'browser QA must not use production credentials or production auth endpoints');

console.log(JSON.stringify({
  ok: true,
  scope: 'authenticated-editor-browser-contract',
  desktopFlow: ['login', 'dashboard', 'page-select', 'edit', 'save', 'reload'],
  mobileWidths: [360, 390, 430],
  productionCredentials: false,
}, null, 2));
