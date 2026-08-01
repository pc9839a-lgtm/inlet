import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const [browserScript, workflow, packageJsonSource, qaAll, templates, parityCheck] = await Promise.all([
  read('scripts/template-mobile-browser-regression-check.mjs'),
  read('.github/workflows/qa.yml'),
  read('package.json'),
  read('scripts/qa-all.mjs'),
  read('src/templates/landingTemplates.js'),
  read('scripts/preview-public-parity-quality-check.mjs'),
]);
const packageJson = JSON.parse(packageJsonSource);

for (const token of [
  'debt-relief-consult',
  'wedding-invitation',
  'quote-request',
  'mobile-360',
  'mobile-390',
  'mobile-430',
  'exerciseFaq',
  'exerciseGallery',
  'exerciseMap',
  'exerciseBottomNavigation',
  'exerciseFormKeyboard',
  'exerciseReservation',
  'qa-audit-',
  'Page.captureScreenshot',
  'INLET_TEMPLATE_MOBILE_QA_CHROME_PATH',
  'three-template-mobile-final-regression',
]) {
  assert(browserScript.includes(token), `template mobile browser script missing ${token}`);
}

for (const token of [
  "id: 'debt-relief-consult'",
  "id: 'wedding-invitation'",
  "id: 'quote-request'",
  "mode: 'gallery'",
  "makeBlock('map'",
  "makeBlock('faq'",
  "makeBlock('reservation'",
]) {
  assert(templates.includes(token), `template source missing ${token}`);
}

assert.equal(packageJson.scripts['browser:templates-mobile:qa'], 'node scripts/template-mobile-browser-regression-check.mjs');
assert.equal(packageJson.scripts['browser:templates-mobile:contract:qa'], 'node scripts/template-mobile-browser-regression-contract-check.mjs');
assert(qaAll.includes("['browser:templates-mobile:contract:qa', ['scripts/template-mobile-browser-regression-contract-check.mjs']]"), 'qa:all must include the template mobile regression contract');

for (const token of [
  'template-mobile-browser-regression:',
  'Real browser three-template mobile regression',
  'INLET_TEMPLATE_MOBILE_QA_ORIGIN: http://127.0.0.1:4176',
  'INLET_TEMPLATE_MOBILE_QA_SCREENSHOT_DIR: .tmp-template-mobile-regression',
  'npm run browser:templates-mobile:qa',
  'template-mobile-regression-${{ github.run_id }}',
]) {
  assert(workflow.includes(token), `QA workflow missing ${token}`);
}
assert(!workflow.includes('continue-on-error: true'), 'template mobile browser regression must remain release-blocking');

for (const token of [
  "workspacePreview.includes('className=\"phone-frame\"')",
  "app.includes('className=\"public-landing-viewport\"')",
  '@container pagero-landing (max-width: 420px)',
  '@container pagero-landing (max-width: 370px)',
]) {
  assert(parityCheck.includes(token), `preview/public parity contract missing ${token}`);
}

assert(!browserScript.includes('captureBeyondViewport: true'), 'mobile screenshots must stay viewport-bounded to keep evidence readable');
assert(!browserScript.includes('setInterval(() => process.exit'), 'browser regression must not hide hangs with a forced success exit');

console.log(JSON.stringify({
  ok: true,
  check: 'template-mobile-browser-regression-contract',
  templates: 3,
  viewports: [360, 390, 430],
  releaseBlocking: true,
  previewPublicParityRequired: true,
}, null, 2));
