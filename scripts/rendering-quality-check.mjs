import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const previewCssFiles = [
  'src/styles/base-components.css',
  'src/styles/preview-core.css',
  'src/styles/preview-forms.css',
  'src/styles/preview-forms-visibility.css',
  'src/styles/preview-forms-design.css',
  'src/styles/preview-forms-basic.css',
  'src/styles/preview-forms-render.css',
  'src/styles/preview-forms-controls.css',
  'src/styles/preview-forms-spacing.css',
  'src/styles/preview-forms-questions.css',
  'src/styles/preview-forms-advanced.css',
  'src/styles/preview-forms-bottom-color.css',
  'src/styles/preview-forms-description.css',
  'src/styles/preview-forms-buttons.css',
  'src/styles/preview-forms-basic-grid.css',
  'src/styles/preview-reservation.css',
  'src/styles/preview-bottom.css',
  'src/styles/preview-widgets.css',
  'src/styles/preview-widgets-timer.css',
  'src/styles/preview-widgets-activity.css',
  'src/styles/preview-widgets-activity-timer-theme.css',
  'src/styles/preview-widgets-activity-feed.css',
  'src/styles/preview-widgets-activity-text.css',
  'src/styles/preview-widgets-activity-dark.css',
  'src/styles/preview-widgets-forms.css',
  'src/styles/preview-widgets-links.css',
  'src/styles/preview-widgets-links-items.css',
  'src/styles/preview-widgets-links-list.css',
  'src/styles/preview-widgets-links-carousel.css',
  'src/styles/preview-widgets-links-card.css',
  'src/styles/preview-workspace.css',
  'src/styles/preview-workspace-bottom-timer.css',
  'src/styles/preview-workspace-hero-media.css',
  'src/styles/preview-workspace-bottom-card.css',
  'src/styles/preview-workspace-topnav-override.css',
  'src/styles/preview-workspace-empty.css',
  'src/styles/preview-workspace-template.css',
  'src/styles/preview-workspace-timer.css',
  'src/styles/preview-workspace-timer-urgency.css',
  'src/styles/preview-workspace-timer-bottom.css',
  'src/styles/preview-workspace-reservation.css',
  'src/styles/preview-workspace-hero-full.css',
  'src/styles/preview-workspace-hero-content.css',
  'src/styles/preview-workspace-topnav-menu.css',
  'src/styles/preview-workspace-topnav-drag.css',
  'src/styles/preview-workspace-topnav-card.css',
  'src/styles/preview-workspace-effects.css',
  'src/styles/preview-workspace-effects-buttons.css',
  'src/styles/preview-workspace-effects-bottom-editor.css',
  'src/styles/preview-workspace-effects-fonts.css',
  'src/styles/preview-workspace-effects-nav.css',
  'src/styles/preview-workspace-effects-widgets.css',
  'src/styles/preview-workspace-effects-map-faq.css',
];

const files = {
  landing: await readFile('src/preview/LandingRenderer.jsx', 'utf8'),
  content: await readFile('src/preview/renderers/ContentBlocks.jsx', 'utf8'),
  form: await readFile('src/preview/renderers/FormBlocks.jsx', 'utf8'),
  info: await readFile('src/preview/renderers/InfoBlocks.jsx', 'utf8'),
  link: await readFile('src/preview/renderers/LinkBlocks.jsx', 'utf8'),
  media: await readFile('src/preview/renderers/MediaBlocks.jsx', 'utf8'),
  signal: await readFile('src/preview/renderers/SignalBlocks.jsx', 'utf8'),
  layout: await readFile('src/preview/renderers/LayoutBlocks.jsx', 'utf8'),
  utility: await readFile('src/preview/renderers/UtilityBlocks.jsx', 'utf8'),
  previewCss: (await Promise.all(previewCssFiles.map((file) => readFile(file, 'utf8')))).join('\n'),
  cssQa: await readFile('scripts/css-quality-check.mjs', 'utf8'),
  browserVisualQa: await readFile('scripts/browser-visual-quality-check.mjs', 'utf8'),
};

const requiredDispatch = [
  "block.type==='topnav'",
  "block.type==='hero'",
  "block.type==='image'",
  "block.type==='text'",
  "block.type==='map'",
  "block.type==='faq'",
  "block.type==='links'",
  "block.type==='timer'",
  "block.type==='activity'",
  "block.type==='spacer'",
  "block.type==='divider'",
  "block.type==='code'",
  "block.type==='search'",
  "block.type==='form'",
  "block.type==='reservation'",
  "block.type==='footer'",
];

for (const token of requiredDispatch) {
  assert(files.landing.includes(token), `LandingRenderer dispatch missing ${token}`);
}

assert(files.landing.indexOf("block.type==='topnav'") < files.landing.indexOf("block.type==='hero'"), 'topnav should render before hero in dispatcher');
assert(files.landing.includes('BlockErrorBoundary'), 'block error boundary should wrap preview blocks');
assert(files.landing.includes('installConversionTracking(page)'), 'public renderer should install conversion tracking');
assert(files.landing.includes('if (templatePreview) return;'), 'template preview should skip conversion tracking');
assert(files.landing.includes('hideBottomForForm'), 'bottom bar should hide when form is visible');

const rendererContracts = [
  [files.content, 'export function RenderHero', 'landing-section hero'],
  [files.content, 'export function RenderText', 'landing-section text'],
  [files.form, 'export function RenderForm', 'landing-section form'],
  [files.form, 'export function RenderReservation', 'reservation-v2'],
  [files.info, 'export function RenderMap', 'inlet-map-section'],
  [files.info, 'export function RenderFaq', 'faq-widget'],
  [files.link, 'export function RenderLinks', 'landing-section links'],
  [files.media, 'export function RenderImage', 'landing-section image-sec'],
  [files.signal, 'export function RenderTimer', 'landing-section timer'],
  [files.signal, 'export function RenderActivity', 'landing-section activity'],
  [files.layout, 'export function RenderTopNav', 'topnav'],
  [files.layout, 'export function RenderFooter', 'landing-footer'],
  [files.utility, 'export function RenderCode', 'landing-section code'],
  [files.utility, 'export function RenderPageSearch', 'landing-section page-search'],
];

for (const [source, exportToken, classToken] of rendererContracts) {
  assert(source.includes(exportToken), `renderer export missing ${exportToken}`);
  assert(source.includes(classToken), `renderer class contract missing ${classToken}`);
}

const previewSourceEntries = Object.entries(files).filter(([name]) => name !== 'previewCss');
for (const [name, source] of previewSourceEntries) {
  assert(!/\b(?:window\.)?(?:alert|confirm)\s*\(/.test(source), `preview source must not use browser alert/confirm: ${name}`);
}

const mojibakePattern = /諛⑸Ц|獄쎻뫖|揆|\?곷|\?덉|\?대쫫|\?묒|�/;
const previewRuntimeEntries = previewSourceEntries.filter(([name]) => name !== 'cssQa');
for (const [name, source] of previewRuntimeEntries) {
  assert(!mojibakePattern.test(source), `preview source contains mojibake text: ${name}`);
}
assert(!mojibakePattern.test(files.previewCss), 'preview css contains mojibake text');

const cssContracts = [
  '.landing-page',
  '.landing-content',
  '.landing-section',
  '.hero',
  '.form',
  '.reservation-v2',
  '.faq-widget',
  '.bottom-bar',
  '.inlet-map-section',
  '.image-sec',
  '.links',
  '.timer',
  '.activity',
  '.landing-footer',
  '.block-render-fallback',
];

for (const selector of cssContracts) {
  assert(files.previewCss.includes(selector), `preview css missing ${selector}`);
}

const visualGeometryContracts = [
  ['hero stable height variable', files.previewCss.includes('--hero-image-height') && files.previewCss.includes('min-height')],
  ['full hero media clips overflow', files.previewCss.includes('.hero-full-media') && /overflow:\s*hidden/.test(files.previewCss)],
  ['form fields use full width', /\.form[\s\S]*input[\s\S]*width:\s*100%|\.form input[\s\S]*width:\s*100%/.test(files.previewCss)],
  ['reservation grid has mobile fallback', files.previewCss.includes('.reservation-v2') && files.previewCss.includes('grid-template-columns: 1fr')],
  ['links cards protect text overflow', files.previewCss.includes('minmax(0,1fr)') && /overflow-wrap|text-overflow/.test(files.previewCss)],
  ['timer grid uses stable tracks', files.previewCss.includes('.timer-grid') && files.previewCss.includes('repeat(4')],
  ['bottom bar keeps fixed button count tracks', files.previewCss.includes('bottom-bar.count-3') && files.previewCss.includes('repeat(3')],
  ['map widget has bounded embed area', files.previewCss.includes('.inlet-map-section') && /min-height|aspect-ratio/.test(files.previewCss)],
  ['faq content has vertical spacing', files.previewCss.includes('.faq-widget') && files.previewCss.includes('gap:')],
  ['selected preview outline suppressed in template mode', files.previewCss.includes('.landing-page.template-preview') && files.previewCss.includes('outline: 0')],
];

for (const [label, ok] of visualGeometryContracts) {
  assert(ok, `visual geometry contract failed: ${label}`);
}

const viewportContracts = [
  ['desktop phone frame is bounded', files.previewCss.includes('.phone-frame') && /width:\s*4[0-9]{2}px/.test(files.previewCss) && /height:\s*7[0-9]{2}px/.test(files.previewCss)],
  ['preview root scrolls inside frame', files.previewCss.includes('.phone-frame .landing-page') && /overflow:\s*auto/.test(files.previewCss)],
  ['preview top link is ellipsized', files.previewCss.includes('.preview-link') && files.previewCss.includes('text-overflow: ellipsis')],
  ['mobile navigation protects horizontal overflow', files.previewCss.includes('.top-menu') && /overflow-x:\s*auto/.test(files.previewCss)],
  ['inline preview notices are styled', files.previewCss.includes('.preview-inline-notice') && files.form.includes('PreviewInlineNotice')],
  ['duplicate submit uses inline prompt', files.form.includes('duplicatePrompt') && files.form.includes('requestDuplicateSubmit')],
];

for (const [label, ok] of viewportContracts) {
  assert(ok, `viewport/browser smoke contract failed: ${label}`);
}

const mobileRules = (files.previewCss.match(/@media\s*\(max-width:\s*(760|820|900)px\)/g) || []).length;
assert(mobileRules >= 2, 'preview css should include mobile viewport rules');
assert(!files.previewCss.includes('position: absolute;\n  position: fixed;'), 'preview css should not contain obvious position override collisions');
assert(files.cssQa.includes('catchAllFileBaselines'), 'css QA should guard focused ownership baselines');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_TEMPLATE_ROUTES'), 'browser visual QA should support template screenshot route hooks');
assert(files.browserVisualQa.includes('resolveTargetUrl'), 'browser visual QA should resolve relative extra/template routes');
assert(files.browserVisualQa.includes("document.querySelector('.error-screen, .app-error-screen, .block-render-fallback')"), 'browser visual QA should detect the app error boundary');
assert(files.browserVisualQa.includes('visibleControls > 0'), 'browser visual QA should fail when an app renders no visible controls or links');
assert(files.browserVisualQa.includes('appErrorText'), 'browser visual QA should fail when app error boundary text is visible');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_REQUIRE'), 'browser visual QA should support mandatory real-browser mode');
assert(files.browserVisualQa.includes('realBrowserCommand'), 'browser visual QA skipped output should include the real-browser command');
assert(files.browserVisualQa.includes('realBrowserPowerShellCommand'), 'browser visual QA skipped output should include a PowerShell real-browser command');

console.log(JSON.stringify({
  ok: true,
  checks: requiredDispatch.length + rendererContracts.length * 2 + cssContracts.length + visualGeometryContracts.length + viewportContracts.length + previewSourceEntries.length * 2 + 15,
  visualGeometryChecks: visualGeometryContracts.length,
  viewportContracts: viewportContracts.length,
}, null, 2));
