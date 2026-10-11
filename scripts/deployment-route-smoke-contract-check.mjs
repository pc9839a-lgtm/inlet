import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const deployScript = await readFile('scripts/deploy-pages.mjs', 'utf8');
const liveCheck = await readFile('scripts/deployment-live-asset-check.mjs', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const qaAll = await readFile('scripts/qa-all.mjs', 'utf8');
const deployWorkflow = await readFile('.github/workflows/deploy-cloudflare.yml', 'utf8');
const productionBrowser = await readFile('scripts/production-browser-quality-check.mjs', 'utf8');

const deployCall = "'pages', 'deploy'";
const liveCheckCall = "'scripts/deployment-live-asset-check.mjs', deploymentUrl";
assert(deployScript.includes(deployCall), 'Cloudflare deploy command is missing');
assert(deployScript.includes(liveCheckCall), 'Cloudflare deployment must run the live smoke gate');
assert(deployScript.indexOf(liveCheckCall) > deployScript.indexOf(deployCall), 'Live smoke gate must run after Cloudflare returns the deployment URL');
assert(deployScript.includes("throw new Error('Cloudflare deployment completed without a detectable pages.dev URL; live asset verification did not run')"), 'Deployment must fail when the Pages URL cannot be detected');

for (const token of [
  "['/login', 'Login route']",
  "['/signup', 'Signup route']",
  "['/about', 'Static information route']",
  "['/contact', 'Contact route']",
  "['/privacy', 'Privacy policy route']",
  "['/terms', 'Terms of service route']",
  "['/app', 'Authenticated workspace shell']",
  "'/robots.txt'",
  "'/sitemap.xml'",
  "'Public crawler policy'",
  "'Public sitemap'",
  "assertPrivateRouteNoindex(result)",
  "checkCrawlerFile(baseUrl, pathname, label, expectedType, requiredTokens)",
  "'/api/admin/summary'",
  "'Protected admin Functions route'",
  "'Public page Functions route'",
  '{ public: 1, fresh: Date.now() }',
  "[401, 403]",
  '[404]',
]) {
  assert(liveCheck.includes(token), `deployment route smoke contract missing: ${token}`);
}

assert(liveCheck.includes("type.includes('text/html')"), 'HTML routes must verify their MIME type');
assert(liveCheck.includes("htmlCacheIsSafe(cache)"), 'HTML routes must verify no-cache/no-store behavior');
assert(liveCheck.includes("/<div\\s+id=[\"']root[\"']/i"), 'HTML routes must verify the React root');
assert(liveCheck.includes("type.includes('application/json') || type.includes('+json')"), 'Functions routes must verify JSON responses');
assert(liveCheck.includes("returned the SPA HTML fallback instead of a Functions response"), 'Functions smoke checks must reject SPA fallback HTML');
assert(liveCheck.includes('routeChecks,'), 'Deployment smoke output must include checked routes');
assert(liveCheck.includes('checkedAssetCount'), 'Deployment smoke gate must retain the full asset graph check');
assert(!/method\s*:\s*['\"](?:POST|PUT|PATCH|DELETE)['\"]/i.test(liveCheck), 'Deployment route smoke gate must remain read-only');

// The deployed browser gate checks rendered legal content, not just a 200 SPA shell.
for (const required of [
  'id: pagero_browser_smoke',
  "if: steps.asset_check.outcome == 'success'",
  "INLET_PRODUCTION_BROWSER_QA_REQUIRE: '1'",
  "INLET_PRODUCTION_QA_INCLUDE_AUTHENTICATED: '0'",
  "INLET_PRODUCTION_QA_INCLUDE_MOCKS: '0'",
  'npm run browser:production:qa',
  'pagero-public-browser-',
  "steps.pagero_browser_smoke.outcome != 'success'",
]) {
  assert(deployWorkflow.includes(required), `deployment workflow is missing browser launch gate: ${required}`);
}
for (const required of [
  "name: 'public home desktop'",
  "name: 'public home mobile'",
  "name: 'public about route'",
  "name: 'public contact route'",
  "name: 'public privacy route'",
  "name: 'public terms route'",
  "'수집하는 개인정보 항목'",
  "'이용약관,이용자의 책임,서비스 목적'",
  "if (testCase.authenticated && !includeAuthenticatedCases) return false",
  "if (testCase.mocked && !includeMockCases) return false",
]) {
  assert(productionBrowser.includes(required), `production browser gate must verify actual public content: ${required}`);
}

assert(packageJson.scripts?.['deployment:smoke:contract:qa'] === 'node scripts/deployment-route-smoke-contract-check.mjs', 'package script deployment:smoke:contract:qa is missing');
assert(qaAll.includes("['deployment:smoke:contract:qa', ['scripts/deployment-route-smoke-contract-check.mjs']]"), 'qa:all must enforce the deployment route smoke contract');

console.log(JSON.stringify({
  ok: true,
  check: 'deployment-route-smoke-contract',
  htmlRoutes: ['/', '/login', '/signup', '/about', '/contact', '/privacy', '/terms', '/app'],
  crawlerFiles: ['/robots.txt', '/sitemap.xml'],
  privateNoindex: ['/login', '/signup', '/app'],
  functionsRoutes: ['/api/admin/summary', '/api/pages/:missingSlug?public=1'],
  readOnly: true,
  deployBlocking: true,
  realBrowserProductionGate: true,
  renderedLegalContent: true,
}, null, 2));
