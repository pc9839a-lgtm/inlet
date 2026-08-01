import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const [browserScript, workflow, packageJsonSource, qaAll, templates, parityCheck, rendererCss, galleryCss, formMobileCss, mediaRenderer] = await Promise.all([
  read('scripts/template-mobile-browser-regression-check.mjs'),
  read('.github/workflows/qa.yml'),
  read('package.json'),
  read('scripts/qa-all.mjs'),
  read('src/templates/landingTemplates.js'),
  read('scripts/preview-public-parity-quality-check.mjs'),
  read('src/preview/LandingRenderer.css'),
  read('src/styles/preview-gallery-mobile-contract.css'),
  read('src/styles/preview-form-mobile-contract.css'),
  read('src/preview/renderers/MediaBlocks.jsx'),
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
  'Page.captureScreenshot',
  'captureBeyondViewport: false',
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

const fixedUiImport = "@import '../styles/preview-fixed-ui-contract.css';";
const galleryImport = "@import '../styles/preview-gallery-mobile-contract.css';";
const formMobileImport = "@import '../styles/preview-form-mobile-contract.css';";
assert(rendererCss.includes(galleryImport), 'LandingRenderer must import the gallery mobile contract');
assert(rendererCss.includes(formMobileImport), 'LandingRenderer must import the form mobile contract');
assert(rendererCss.indexOf(galleryImport) < rendererCss.indexOf(fixedUiImport), 'gallery contract must preserve the final fixed UI import priority');
assert(rendererCss.indexOf(formMobileImport) < rendererCss.indexOf(fixedUiImport), 'form mobile contract must preserve the final fixed UI import priority');

for (const token of [
  '.phone-frame .image-sec .gallery-arrows button',
  '.public-landing-viewport .image-sec .gallery-arrows button',
  'width: 44px !important',
  'min-width: 44px !important',
  'height: 44px !important',
  'min-height: 44px !important',
  'touch-action: manipulation !important',
  ':focus-visible',
]) {
  assert(galleryCss.includes(token), `gallery touch contract missing ${token}`);
}

for (const token of [
  '.phone-frame .landing-section.form .agree',
  '.public-landing-viewport .landing-section.form .agree',
  'min-height: 44px !important',
  "input[type='checkbox']",
  'width: 36px !important',
  'height: 36px !important',
  'appearance: none !important',
  ':checked',
  ':focus-visible',
  'touch-action: manipulation !important',
]) {
  assert(formMobileCss.includes(token), `form mobile touch contract missing ${token}`);
}

for (const token of [
  'GALLERY_CONTROL_SELECTOR',
  'isGalleryControlTarget(event.target)',
  'setPointerCapture?.(event.pointerId)',
  'aria-label={`이미지 ${index + 1}`}',
]) {
  assert(mediaRenderer.includes(token), `gallery renderer pointer contract missing ${token}`);
}
assert(mediaRenderer.indexOf('isGalleryControlTarget(event.target)') < mediaRenderer.indexOf('setPointerCapture?.(event.pointerId)'), 'interactive gallery controls must be excluded before pointer capture starts');

assert(!browserScript.includes('captureBeyondViewport: true'), 'mobile screenshots must stay viewport-bounded to keep evidence readable');
assert(!browserScript.includes('setInterval(() => process.exit'), 'browser regression must not hide hangs with a forced success exit');

console.log(JSON.stringify({
  ok: true,
  check: 'template-mobile-browser-regression-contract',
  templates: 3,
  viewports: [360, 390, 430],
  galleryTouchTargetPx: 44,
  consentRowTouchTargetPx: 44,
  consentCheckboxHitBoxPx: 36,
  galleryControlsOutsideSwipeCapture: true,
  releaseBlocking: true,
  previewPublicParityRequired: true,
}, null, 2));
