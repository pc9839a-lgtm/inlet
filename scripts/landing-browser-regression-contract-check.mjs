import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const visual = await readFile('scripts/landing-browser-regression-check.mjs', 'utf8');
const workflow = await readFile('.github/workflows/qa.yml', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const qaAll = await readFile('scripts/qa-all.mjs', 'utf8');
const landingCss = await readFile('src/preview/LandingRenderer.css', 'utf8');
const topnavRuntimeCss = await readFile('src/styles/preview-topnav-runtime-contract.css', 'utf8');

for (const token of [
  "{ name: 'desktop', width: 1440",
  "{ name: 'mobile-360', width: 360",
  "{ name: 'mobile-390', width: 390",
  "{ name: 'mobile-430', width: 430",
]) {
  assert(visual.includes(token), `real browser viewport contract missing: ${token}`);
}

assert(visual.includes("slug: 'visual-regression'") && visual.includes("localStorage.setItem(${JSON.stringify(STORAGE_KEY)}"), 'visual QA must seed the same-slug local page before the real public route starts');
assert(visual.includes('JSON.stringify([4, 3])'), 'seven-menu browser QA must enforce a 4+3 row split');
assert(visual.includes('menu button ${index + 1} touch height is below 44px'), 'browser QA must enforce 44px menu touch targets');
assert(visual.includes('share button overlaps bottom bar'), 'browser QA must reject share/bottom-bar overlap');
assert(visual.includes('public viewport exceeded 414px'), 'browser QA must reject desktop public viewport spill');
assert(visual.includes("viewport.name === 'mobile-390'"), 'form focus browser scenario must run at 390px');
assert(visual.includes('hidden(focused.topnavState') && visual.includes('hidden(focused.bottomState'), 'form focus browser QA must enforce hidden fixed UI');
assert(visual.includes('Page.captureScreenshot') && visual.includes('-baseline.png') && visual.includes('-form-focus.png'), 'browser QA must emit baseline and focused screenshots');
assert(visual.includes("'/usr/bin/google-chrome'") && visual.includes("'/usr/bin/chromium'"), 'browser QA must resolve Linux Chrome/Chromium');

const runtimeImport = "@import '../styles/preview-topnav-runtime-contract.css';";
assert(landingCss.includes(runtimeImport), 'LandingRenderer must import the final topnav runtime contract');
assert(landingCss.lastIndexOf(runtimeImport) > landingCss.lastIndexOf("@import '../styles/preview-runtime-parity.css';"), 'topnav runtime contract must load after parity CSS');
assert(landingCss.lastIndexOf(runtimeImport) > landingCss.lastIndexOf("@import '../styles/preview-fixed-ui-contract.css';"), 'topnav runtime contract must load after fixed UI CSS');
for (const count of [5, 6, 7, 8]) {
  assert(topnavRuntimeCss.includes(`topnav-menu-count-${count}`), `final runtime CSS missing ${count}-menu contract`);
}
assert(topnavRuntimeCss.includes('repeat(12, minmax(0, 1fr))') && topnavRuntimeCss.includes('nth-child(n + 5)'), 'final runtime CSS must enforce the seven-menu 4+3 layout');

assert(packageJson.scripts?.['browser:landing:qa'] === 'node scripts/landing-browser-regression-check.mjs', 'package script browser:landing:qa missing');
assert(packageJson.scripts?.['browser:landing:contract:qa'] === 'node scripts/landing-browser-regression-contract-check.mjs', 'package script browser:landing:contract:qa missing');
assert(qaAll.includes("['browser:landing:contract:qa', ['scripts/landing-browser-regression-contract-check.mjs']]"), 'qa:all must enforce the browser regression wiring contract');

assert(workflow.includes('browser-regression:'), 'QA workflow must include a browser-regression job');
assert(workflow.includes('needs: qa'), 'browser regression must run after offline QA');
assert(workflow.includes('npm run build'), 'browser regression job must build production assets');
assert(workflow.includes('npm run preview -- --host 127.0.0.1 --port 4173'), 'browser regression job must start the production preview server');
assert(workflow.includes('npm run browser:landing:qa'), 'browser regression job must run the real browser gate');
assert(workflow.includes('actions/upload-artifact@v4'), 'browser screenshots must be uploaded as a workflow artifact');
assert(workflow.includes('.tmp-landing-browser-regression'), 'browser screenshot artifact path missing');

console.log(JSON.stringify({ ok: true, viewports: ['desktop', 'mobile-360', 'mobile-390', 'mobile-430'], scenarios: ['baseline', 'form-focus'], finalCss: 'preview-topnav-runtime-contract.css' }, null, 2));
