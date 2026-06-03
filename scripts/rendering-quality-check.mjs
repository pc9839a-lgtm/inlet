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
  'src/styles/preview-download.css',
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
  'src/styles/preview-public.css',
];

const files = {
  landing: await readFile('src/preview/LandingRenderer.jsx', 'utf8'),
  app: await readFile('src/App.jsx', 'utf8'),
  editPanel: await readFile('src/editor/EditPanel.jsx', 'utf8'),
  content: await readFile('src/preview/renderers/ContentBlocks.jsx', 'utf8'),
  form: await readFile('src/preview/renderers/FormBlocks.jsx', 'utf8'),
  formEditor: await readFile('src/editor/blockEditors/FormEditor.jsx', 'utf8'),
  info: await readFile('src/preview/renderers/InfoBlocks.jsx', 'utf8'),
  link: await readFile('src/preview/renderers/LinkBlocks.jsx', 'utf8'),
  media: await readFile('src/preview/renderers/MediaBlocks.jsx', 'utf8'),
  signal: await readFile('src/preview/renderers/SignalBlocks.jsx', 'utf8'),
  layout: await readFile('src/preview/renderers/LayoutBlocks.jsx', 'utf8'),
  utility: await readFile('src/preview/renderers/UtilityBlocks.jsx', 'utf8'),
  formEmbed: await readFile('src/lib/formEmbed.js', 'utf8'),
  publicFormEmbed: await readFile('public/embed/form.js', 'utf8'),
  previewCss: (await Promise.all(previewCssFiles.map((file) => readFile(file, 'utf8')))).join('\n'),
  cssQa: await readFile('scripts/css-quality-check.mjs', 'utf8'),
  browserVisualQa: await readFile('scripts/browser-visual-quality-check.mjs', 'utf8'),
};

new Function(files.publicFormEmbed);

const requiredDispatch = [
  "block.type==='topnav'",
  "block.type==='hero'",
  "block.type==='image'",
  "block.type==='text'",
  "block.type==='map'",
  "block.type==='faq'",
  "block.type==='links'",
  "block.type==='download'",
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
assert(files.landing.includes('publicView={publicView}'), 'public bottom bar should receive public rendering mode');
assert(files.landing.includes('accent={page.theme.accent}'), 'public bottom bar should receive page accent variable');
assert(files.landing.includes("'--accent': accent"), 'bottom bar should expose accent when rendered outside landing page');
assert(files.landing.includes('public-bottom-bar'), 'public bottom bar should have a stable public-only class');
assert(!files.layout.includes('top-menu-set-copy') && !files.layout.includes('aria-hidden={duplicate'), 'topnav renderer should not render duplicated loop menu items');
assert(files.layout.includes('function topNavLogoTextColor') && files.layout.includes("if (logoStyle === 'badge')"), 'badge topnav logo text should use contrast-safe color logic');
assert(files.layout.includes("savedText === logoColor") && files.layout.includes("isDarkHex(logoColor)"), 'badge topnav logo text should repair stale same-color values');

const rendererContracts = [
  [files.content, 'export function RenderHero', 'landing-section hero'],
  [files.content, 'export function RenderText', 'landing-section text'],
  [files.form, 'export function RenderForm', 'landing-section form'],
  [files.form, 'export function RenderReservation', 'reservation-v2'],
  [files.info, 'export function RenderMap', 'inlet-map-section'],
  [files.info, 'export function RenderFaq', 'faq-widget'],
  [files.link, 'export function RenderLinks', 'landing-section links'],
  [files.link, 'export function RenderDownload', 'landing-section download-widget'],
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

const mojibakePattern = /獄쎻뫖揆|占|�/;
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
  '.download-widget',
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
  ['bottom bar count-3 is not overridden to two columns', !/\.bottom-bar\.count-3\s*\{[^}]*repeat\(2/i.test(files.previewCss)],
  ['public landing bottom CTA is fixed inside 860 shell', files.previewCss.includes('.public-landing-viewport .public-bottom-bar') && files.previewCss.includes('position: fixed') && files.previewCss.includes('width: min(860px, 100vw)') && files.previewCss.includes('max-width: 860px')],
  ['public landing bottom CTA uses editor button colors', files.previewCss.includes('.public-landing-viewport .public-bottom-bar button') && files.previewCss.includes('background: var(--bottom-button') && files.previewCss.includes('color: var(--bottom-button-text')],
  ['public landing bottom CTA does not add a white overlay', files.previewCss.includes('.public-landing-viewport .public-bottom-bar') && files.previewCss.includes('background: transparent !important') && files.previewCss.includes('box-shadow: none !important')],
  ['public landing reserves bottom CTA space', files.previewCss.includes('.landing-page.public-render.has-bottom-bar .landing-content') && files.previewCss.includes('padding-bottom: calc(126px + env(safe-area-inset-bottom, 0px))')],
  ['public landing topnav is fixed inside 860 shell', files.previewCss.includes('.public-landing-viewport .topnav.topnav-one-line') && files.previewCss.includes('position: fixed') && files.previewCss.includes('grid-template-columns: minmax(88px, max-content) minmax(0, 1fr)')],
  ['public landing keeps topnav loop disabled', files.previewCss.includes('.public-landing-viewport .topnav-menu-loop .top-menu-track') && files.previewCss.includes('animation: none !important') && files.previewCss.includes('.public-landing-viewport .top-menu-set-copy')],
  ['map widget has bounded embed area', files.previewCss.includes('.inlet-map-section') && /min-height|aspect-ratio/.test(files.previewCss)],
  ['faq content has vertical spacing', files.previewCss.includes('.faq-widget') && files.previewCss.includes('gap:')],
  ['widget box options render visible background and shadow', files.previewCss.includes('background:var(--widget-bg') && files.previewCss.includes('.landing-section.widget-shadow-on') && !/\.landing-section\.widget-shadow-on\s*\{[^}]*box-shadow:\s*none/i.test(files.previewCss)],
  ['utility widgets use shared widget box options', files.utility.includes('widgetBoxClass(s)') && files.utility.includes('widgetBoxVars(s)') && files.utility.includes('page-search-widget')],
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
assert(files.browserVisualQa.includes('local-chrome-cdp'), 'browser visual QA should support local Chrome/Edge CDP without Playwright');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_CHROME_PATH'), 'browser visual QA should allow a custom local Chrome/Edge path');
assert(files.formEmbed.includes('https://pagero.kr/embed/form.js'), 'standalone form embed should use the compact Pagero loader');
assert(files.formEmbed.includes('data-pagero-page=') && files.formEmbed.includes('data-pagero-form-id=') && files.formEmbed.includes('data-pagero-project-id=') && !files.formEmbed.includes('type="application/json"'), 'standalone form embed should prefer a short page/form loader with project identity');
assert(files.formEmbed.includes('<script src="${DEFAULT_EMBED_SCRIPT_URL}" data-pagero-page=') && !files.formEmbed.includes('<div data-pagero-page='), 'standalone form embed should generate a single short script tag');
assert(files.publicFormEmbed.includes("var API_URL = HOME_URL + '/api/leads'") || files.publicFormEmbed.includes('https://pagero.kr/api/leads'), 'standalone form embed loader should submit to Pagero lead API');
assert(files.publicFormEmbed.includes('decodeConfig') && files.publicFormEmbed.includes("script.getAttribute('data-pagero')"), 'standalone form embed loader should keep inline compact config compatibility');
assert(files.publicFormEmbed.includes('fetchPublicFormConfig') && files.publicFormEmbed.includes("script.getAttribute('data-page')") && files.publicFormEmbed.includes("script.getAttribute('data-pagero-project-id')"), 'standalone form embed loader should fetch saved public page config from short embed attrs');
assert(files.publicFormEmbed.includes('function fetchPublicPage') && files.publicFormEmbed.includes("fetch(publicPageUrl(slug, ''))"), 'standalone form embed loader should fall back to slug-only public page lookup');
assert(files.publicFormEmbed.includes('data-pagero-page') && files.publicFormEmbed.includes('data-pagero-project-id') && files.publicFormEmbed.includes('initElement'), 'standalone form embed loader should support div + script embed targets with project identity');
assert(files.formEmbed.includes('projectId: safePage.projectId'), 'standalone form embed should include the page project id');
assert(files.formEmbed.includes('slug: safePage.slug'), 'standalone form embed should include the page slug');
assert(files.publicFormEmbed.includes('answers: extracted.answers'), 'standalone form embed should preserve structured answers');
assert(files.publicFormEmbed.includes('function readJsonSafe') && files.publicFormEmbed.includes('function submitErrorMessage') && files.publicFormEmbed.includes('\\uBC18\\uBCF5 \\uC811\\uC218\\uB85C'), 'standalone form embed should map submit failures to user-safe messages');
assert(!/\?\?/.test(files.publicFormEmbed), 'standalone form embed should not contain mojibake fallback question marks');
assert(files.form.includes('function digitsOnly') && files.form.includes('inputMode="numeric"') && files.form.includes('pattern="[0-9]*"'), 'preview form phone fields should force numeric input');
assert(files.publicFormEmbed.includes('data-pagero-phone="1"') && files.publicFormEmbed.includes('inputmode="numeric"') && files.publicFormEmbed.includes('digitsOnly(firstAnswer'), 'standalone form phone fields should force and submit numeric input');
assert(files.publicFormEmbed.includes('\\uC811\\uC218 \\uC800\\uC7A5\\uC5D0 \\uC2E4\\uD328'), 'standalone form embed should show server save failure');
assert(files.publicFormEmbed.includes('\\uD398\\uC774\\uC9C0\\uB85C\\uB85C \\uC81C\\uC791') && files.publicFormEmbed.includes('sourceLabel'), 'standalone form embed should show Pagero credit and preserve attribution');
assert(files.formEditor.includes('Step title="디자인"') && files.formEditor.includes('buttonHover') && files.formEditor.includes('buttonColorMode') && files.formEditor.includes('buttonHoverColorMode'), 'form editor should expose form style, button effect, and button color controls');
assert(files.previewCss.includes('.form-color-row') && files.previewCss.includes('.form-button-hover-fill') && files.previewCss.includes('.form-input-underline'), 'form design controls should have matching preview css contracts');
assert(!files.previewCss.includes('form-button-anim-') && !files.previewCss.includes('form-button-overlay'), 'form button effects should use the single buttonHover contract');
assert(files.browserVisualQa.includes("INLET_BROWSER_QA_EXTRA_URLS=auto"), 'browser visual QA should document automatic footer/legal route coverage');
assert(files.browserVisualQa.includes("'/privacy'") && files.browserVisualQa.includes("'/terms'"), 'browser visual QA auto routes should cover legal pages');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_STATE_PRESET'), 'browser visual QA should support authenticated state presets');
assert(files.browserVisualQa.includes('owner-settings') && files.browserVisualQa.includes('client-settings') && files.browserVisualQa.includes('manager-limited'), 'browser visual QA should include owner, client admin, and manager authenticated presets');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_CLICK_TEXT'), 'browser visual QA should support post-navigation interaction checks');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_CLICK_SELECTOR'), 'browser visual QA should support precise selector interaction checks');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_SET_INPUT'), 'browser visual QA should support input mutation checks');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_RICH_FORMAT'), 'browser visual QA should support rich text toolbar formatting checks');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_EXPECT_COMPUTED'), 'browser visual QA should support computed-style checks');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_EXPECT_TEXT'), 'browser visual QA should assert authenticated screen text');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_FORBID_TEXT'), 'browser visual QA should assert forbidden text is absent');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_VIEWPORTS'), 'browser visual QA should allow desktop-only authenticated checks');
assert(files.browserVisualQa.includes('--window-size=1280,900'), 'local Chrome visual QA should launch with a desktop-sized window');
assert(files.app.includes("if (['topnav', 'bottombar', 'footer'].includes(target?.type))") && files.app.includes("setOpenId('');\n      return;"), 'preview fixed blocks should not auto-open editor panels');
assert(files.app.includes("setOpenId('');\n    setAddOpen(false);") && files.editPanel.includes("openId===topNavBlock.id?'접기':'열기'"), 'edit entry should keep fixed block panels closed until explicitly opened');
assert(!/[�]|占|獄|揆|\?몄|\?꾩|蹂듭|遺덈|紐|釉|湲|肄/.test(files.editPanel), 'edit panel source should not contain mojibake labels');
const productionBrowserQa = await readFile('scripts/production-browser-quality-check.mjs', 'utf8');
assert(productionBrowserQa.includes('owner style text color live preview'), 'production browser QA should cover style text color live preview');
assert(productionBrowserQa.includes('owner style font tone live preview') && productionBrowserQa.includes('.landing-page.font-bold.font-family-serif'), 'production browser QA should cover style font/tone live preview');
assert(productionBrowserQa.includes('owner rich text bold underline toolbar') && productionBrowserQa.includes('INLET_BROWSER_QA_RICH_FORMAT'), 'production browser QA should cover rich text bold/underline toolbar formatting');

console.log(JSON.stringify({
  ok: true,
  checks: requiredDispatch.length + rendererContracts.length * 2 + cssContracts.length + visualGeometryContracts.length + viewportContracts.length + previewSourceEntries.length * 2 + 33,
  visualGeometryChecks: visualGeometryContracts.length,
  viewportContracts: viewportContracts.length,
}, null, 2));
