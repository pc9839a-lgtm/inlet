import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const visual = await readFile('scripts/landing-browser-regression-check.mjs', 'utf8');
const workflow = await readFile('.github/workflows/qa.yml', 'utf8');
const deployWorkflow = await readFile('.github/workflows/deploy-cloudflare.yml', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const qaAll = await readFile('scripts/qa-all.mjs', 'utf8');
const landingCss = await readFile('src/preview/LandingRenderer.css', 'utf8');
const topnavRuntimeCss = await readFile('src/styles/preview-topnav-runtime-contract.css', 'utf8');
const bottomTimerCss = await readFile('src/styles/preview-workspace-bottom-timer-effects.css', 'utf8');
const legacyBottomTimerCss = await readFile('src/styles/preview-workspace-bottom-timer.css', 'utf8');
const legacyTimerBottomCss = await readFile('src/styles/preview-workspace-timer-bottom.css', 'utf8');
const timerUrgencyCss = await readFile('src/styles/preview-workspace-timer-urgency.css', 'utf8');
const fixedUiCss = await readFile('src/styles/preview-fixed-ui-contract.css', 'utf8');
const focusCss = await readFile('src/styles/preview-form-focus-fixed-ui.css', 'utf8');
const signalBlocks = await readFile('src/preview/renderers/SignalBlocks.jsx', 'utf8');

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
assert(visual.includes('function createQaPage(menuCount = 7)') && visual.includes('storageScript(5)'), 'browser QA must render a dedicated five-menu scenario');
assert(visual.includes('assertFiveMenuLeftAligned') && visual.includes('menu 4 must align with menu 1') && visual.includes('menu 5 must align with menu 2'), 'five-menu browser QA must compare real x coordinates');
assert(visual.includes('await evaluate(client, storageScript(7));'), 'five-menu browser QA must restore the seven-menu baseline before the next viewport');
assert(visual.includes('JSON.stringify([3, 2])'), 'five-menu browser QA must enforce a 3+2 row split');
assert(visual.includes('menu button ${index + 1} touch height is below 44px'), 'browser QA must enforce 44px menu touch targets');
assert(visual.includes('share button overlaps bottom bar'), 'browser QA must reject share/bottom-bar overlap');
assert(visual.includes('public viewport exceeded 414px'), 'browser QA must reject desktop public viewport spill');
assert(visual.includes("viewport.name === 'mobile-390'"), 'form focus browser scenario must run at 390px');
assert(visual.includes('Input.dispatchMouseEvent') && visual.includes('Real pointer click did not focus the form input'), 'form focus scenario must use a real pointer click and verify the active control');
assert(visual.includes('assertHidden(focused.topnavState') && visual.includes('assertHidden(focused.bottomState'), 'form focus browser QA must enforce hidden fixed UI');
assert(visual.includes('Page.captureScreenshot') && visual.includes('-baseline.png') && visual.includes('-form-focus.png') && visual.includes('-five-menu-left.png'), 'browser QA must emit baseline, focused, and five-menu alignment screenshots');
assert(visual.includes("'/usr/bin/google-chrome'") && visual.includes("'/usr/bin/chromium'"), 'browser QA must resolve Linux Chrome/Chromium');

const parityImport = "@import '../styles/preview-runtime-parity.css';";
const topnavImport = "@import '../styles/preview-topnav-runtime-contract.css';";
const bottomTimerImport = "@import '../styles/preview-workspace-bottom-timer-effects.css';";
const removedCompactImport = "@import '../styles/preview-bottom-timer-compact.css';";
const fixedImport = "@import '../styles/preview-fixed-ui-contract.css';";
assert(landingCss.includes(topnavImport), 'LandingRenderer must import the final topnav runtime contract');
assert(landingCss.includes(bottomTimerImport), 'LandingRenderer must import the consolidated bottom timer contract');
assert(!landingCss.includes(removedCompactImport), 'LandingRenderer must not import the deleted compact override layer');
assert(landingCss.lastIndexOf(bottomTimerImport) < landingCss.lastIndexOf(parityImport), 'bottom timer owner must load before shared runtime containment CSS');
assert(landingCss.lastIndexOf(topnavImport) > landingCss.lastIndexOf(parityImport), 'topnav runtime contract must load after parity CSS');
assert(landingCss.lastIndexOf(fixedImport) > landingCss.lastIndexOf(topnavImport), 'fixed UI contract must remain the final imported stylesheet');
assert(landingCss.lastIndexOf(fixedImport) === landingCss.lastIndexOf('@import '), 'no stylesheet may load after the fixed UI contract');

for (const count of [5, 6, 7, 8]) {
  assert(topnavRuntimeCss.includes(`topnav-menu-count-${count}`), `final runtime CSS missing ${count}-menu contract`);
}
assert(topnavRuntimeCss.includes('repeat(12, minmax(0, 1fr))') && topnavRuntimeCss.includes('nth-child(n + 5)'), 'final runtime CSS must enforce the seven-menu 4+3 layout');
assert(focusCss.includes('.landing-page:has(.landing-section.form') && focusCss.includes('.public-landing-viewport:has(.landing-section.form'), 'form focus CSS must include state-independent :has fallbacks');
assert(focusCss.includes('pointer-events: none !important') && focusCss.includes('visibility: hidden !important'), 'focused form controls must disable and hide fixed UI');

for (const token of [
  'min-height: 42px !important',
  'border-radius: 12px !important',
  'height: 2px !important',
  'content: none !important',
  'box-shadow: none !important',
  '@container pagero-landing (max-width: 370px)',
]) {
  assert(bottomTimerCss.includes(token), `consolidated bottom timer CSS missing ${token}`);
}
assert(!bottomTimerCss.includes('data-timer-badge'), 'consolidated bottom timer CSS must not restore the floating promo badge');
assert(!bottomTimerCss.includes('@media (max-width: 430px)'), 'bottom timer sizing must use the landing container instead of browser viewport width');
assert(!legacyBottomTimerCss.includes('.bottom-timer'), 'legacy bottom timer manifest stub must not contain runtime selectors');
assert(!legacyTimerBottomCss.includes('.bottom-timer'), 'legacy timer-bottom manifest stub must not contain runtime selectors');
assert(!timerUrgencyCss.includes('.bottom-timer'), 'main timer urgency CSS must not style the fixed bottom timer');
assert(!fixedUiCss.includes(':has(.bottom-timer) .bottom-timer'), 'fixed collision CSS must not own bottom timer geometry');
assert(signalBlocks.includes("const compactLabel = variant === 'promo' && promoBadge ? `${promoBadge} · ${label}` : label;"), 'bottom timer must merge the promotional badge into the editable left copy');
assert(signalBlocks.includes('data-timer-badge=""') && signalBlocks.includes('data-timer-label={t.done ? endedLabel : compactLabel}'), 'bottom timer must render copy and an empty badge directly through React');
assert(signalBlocks.includes("style={{ '--bottom-timer-progress': `${progress}%` }}"), 'bottom timer must render progress directly through React');
assert(signalBlocks.includes("const label = (rawLabel || '혜택 마감까지').slice(0, 40);"), 'bottom timer must keep a visible fallback label when the editable copy is empty');
assert(!signalBlocks.includes('syncBottomTimerPresentation') && !signalBlocks.includes("document.querySelectorAll('.bottom-timer')"), 'bottom timer must not restore post-render DOM synchronization');
assert(fixedUiCss.includes('gap: 4px !important') && fixedUiCss.includes('height: 48px !important'), 'fixed action contract must keep the timer/button stack compact');
assert(fixedUiCss.includes('border-radius: 17px !important'), 'timer-enabled pill buttons must use a controlled radius instead of oversized capsules');

assert(packageJson.scripts?.['browser:landing:qa'] === 'node scripts/landing-browser-regression-check.mjs', 'package script browser:landing:qa missing');
assert(packageJson.scripts?.['browser:landing:contract:qa'] === 'node scripts/landing-browser-regression-contract-check.mjs', 'package script browser:landing:contract:qa missing');
assert(qaAll.includes("['browser:landing:contract:qa', ['scripts/landing-browser-regression-contract-check.mjs']]"), 'qa:all must enforce the browser regression wiring contract');

assert(workflow.includes('browser-regression:'), 'QA workflow must include a browser-regression job');
assert(!workflow.includes('browser-regression:\n    needs: qa'), 'landing browser regression must run independently so static QA failures do not suppress browser diagnostics');
assert(workflow.includes('npm run build'), 'browser regression job must build production assets');
assert(workflow.includes('npm run preview -- --host 127.0.0.1 --port 4173'), 'browser regression job must start the production preview server');
assert(workflow.includes('npm run browser:landing:qa'), 'browser regression job must run the real browser gate');
assert(workflow.includes('actions/upload-artifact@v4'), 'browser screenshots must be uploaded as a workflow artifact');
assert(workflow.includes('.tmp-landing-browser-regression'), 'browser screenshot artifact path missing');
assert(workflow.includes('include-hidden-files: true'), 'hidden browser screenshot directory must be included in the artifact');
assert(deployWorkflow.includes('workflow_run:') && deployWorkflow.includes('- QA') && deployWorkflow.includes("github.event.workflow_run.conclusion == 'success'") && deployWorkflow.includes("github.event.workflow_run.head_branch == 'main'"), 'production deployment must remain gated on the complete successful QA workflow');
assert(deployWorkflow.includes('ref: ${{ steps.source.outputs.sha }}'), 'production deployment must checkout the exact SHA that passed QA');

console.log(JSON.stringify({
  ok: true,
  viewports: ['desktop', 'mobile-360', 'mobile-390', 'mobile-430'],
  scenarios: ['baseline', 'form-focus', 'five-menu-left'],
  inputMethod: 'real-pointer',
  finalTopnavCss: 'preview-topnav-runtime-contract.css',
  bottomTimerOwner: 'SignalBlocks.RenderBottomTimer',
  bottomTimerRendering: 'declarative-react',
  removedOverrideLayer: 'preview-bottom-timer-compact.css',
  finalStylesheet: 'preview-fixed-ui-contract.css',
  focusFallback: true,
  browserJobsParallel: true,
  deployAfterFullQa: true,
  artifactIncludesHiddenFiles: true,
}, null, 2));
