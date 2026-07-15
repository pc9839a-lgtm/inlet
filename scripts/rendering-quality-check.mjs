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
  'src/styles/preview-schedule.css',
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
  'src/styles/preview-cards.css',
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
  'src/styles/preview-widget-style-options.css',
  'src/styles/preview-workspace-effects-map-faq.css',
  'src/styles/preview-public.css',
];

const files = {
  landing: await readFile('src/preview/LandingRenderer.jsx', 'utf8'),
  landingCss: await readFile('src/preview/LandingRenderer.css', 'utf8'),
  animationCard: await readFile('src/editor/editPanelParts/AnimationOptionsCard.jsx', 'utf8'),
  animationPlayback: await readFile('src/editor/editPanelParts/AnimationPlaybackOptions.jsx', 'utf8'),
  fixedBlockBody: await readFile('src/editor/editPanelParts/FixedBlockCardBody.jsx', 'utf8'),
  pageModel: await readFile('src/lib/pageModel.js', 'utf8'),
  editorWorkspaceCss: await readFile('src/styles/editor-workspace-v2.css', 'utf8'),
  app: await readFile('src/App.jsx', 'utf8'),
  editPanel: await readFile('src/editor/EditPanel.jsx', 'utf8'),
  workspaceShellActions: await readFile('src/runtime/useWorkspaceShellActions.js', 'utf8'),
  fixedBlockSelection: await readFile('src/editor/useFixedBlockSelection.js', 'utf8'),
  pageGlobalOptionsProps: await readFile('src/editor/editPanelSectionProps/pageGlobalOptionsProps.js', 'utf8'),
  content: await readFile('src/preview/renderers/ContentBlocks.jsx', 'utf8'),
  form: await readFile('src/preview/renderers/FormBlocks.jsx', 'utf8'),
  formEditor: await readFile('src/editor/blockEditors/FormEditor.jsx', 'utf8'),
  formDesign: await readFile('src/editor/blockEditors/FormDesignSection.jsx', 'utf8'),
  formSubmission: await readFile('src/editor/blockEditors/FormSubmissionSection.jsx', 'utf8'),
  imageDisplay: await readFile('src/editor/blockEditors/ImageDisplayControls.jsx', 'utf8'),
  imageGallery: await readFile('src/editor/blockEditors/ImageGalleryDisplaySection.jsx', 'utf8'),
  codeEditor: await readFile('src/editor/blockEditors/CodeEditor.jsx', 'utf8'),
  searchDisplay: await readFile('src/editor/blockEditors/SearchDisplaySection.jsx', 'utf8'),
  info: await readFile('src/preview/renderers/InfoBlocks.jsx', 'utf8'),
  link: await readFile('src/preview/renderers/LinkBlocks.jsx', 'utf8'),
  media: await readFile('src/preview/renderers/MediaBlocks.jsx', 'utf8'),
  signal: await readFile('src/preview/renderers/SignalBlocks.jsx', 'utf8'),
  layout: await readFile('src/preview/renderers/LayoutBlocks.jsx', 'utf8'),
  widgetStyles: await readFile('src/editor/blockEditors/WidgetStylePanels.jsx', 'utf8'),
  heroImage: await readFile('src/editor/blockEditors/HeroImageSection.jsx', 'utf8'),
  dividerEditor: await readFile('src/editor/blockEditors/DividerEditor.jsx', 'utf8'),
  conciseEditorCopy: (await Promise.all([
    'HeroBasicSection.jsx',
    'CardsBasicSection.jsx',
    'CardsItemFields.jsx',
    'DownloadItemFields.jsx',
    'FormBasicSection.jsx',
    'ImageBasicSection.jsx',
    'LinkItemFields.jsx',
    'ReservationBasicSection.jsx',
    'ReservationFixedFields.jsx',
    'TimerBasicSection.jsx',
    'TimerCtaTargetSection.jsx',
    'TopNavBasicSection.jsx',
    'BottomBarTimerSection.jsx',
  ].map((file) => readFile(`src/editor/blockEditors/${file}`, 'utf8')))).join('\n'),
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
assert(files.animationCard.includes('updateTheme({ animPlayback })'), 'animation editor must persist the selected playback mode');
assert(files.animationPlayback.includes('ANIMATION_PLAYBACK_OPTIONS') && files.animationPlayback.includes('aria-pressed={value === key}'), 'animation playback control must expose once and loop as accessible choices');
assert(files.pageModel.includes("animPlayback: 'once'"), 'new and legacy pages must default animation playback to once');
assert(files.landing.includes("page.theme.animPlayback === 'loop'") && files.landing.includes('prepareForReentry') && files.landing.includes('if (!replayOnReentry) observer.unobserve(entry.target)') && !files.landing.includes('window.setInterval'), 'loop mode must replay on viewport re-entry while once mode stops observing after the first reveal');
assert(files.fixedBlockBody.includes('fixed-block-editor selected-block-settings-body block-editor'), 'fixed page widgets must share the selected widget editor shell');
assert(files.editorWorkspaceCss.includes('.edit-animation-playback-options') && files.editorWorkspaceCss.includes('width: 50px !important'), 'animation playback and page option controls must keep their intended layout');

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
  [files.info, 'export function RenderSchedule', 'schedule-widget'],
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
  '.schedule-widget',
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
  ['public landing bottom CTA supports preset and custom colors', files.previewCss.includes('.public-landing-viewport .public-bottom-bar.color-accent button') && files.previewCss.includes('.public-landing-viewport .public-bottom-bar.color-light button') && files.previewCss.includes('.public-landing-viewport .public-bottom-bar.bottom-custom-color button')],
  ['public landing bottom CTA does not add a white overlay', files.previewCss.includes('.public-landing-viewport .public-bottom-bar') && files.previewCss.includes('background: transparent !important') && files.previewCss.includes('box-shadow: none !important')],
  ['public landing reserves bottom CTA space', files.previewCss.includes('.landing-page.public-render.has-bottom-bar .landing-content') && files.previewCss.includes('padding-bottom: calc(126px + env(safe-area-inset-bottom, 0px))')],
  ['public landing topnav stays bounded and honors sticky mode', files.previewCss.includes('.public-landing-viewport .topnav.topnav-one-line') && files.previewCss.includes('.public-landing-viewport .topnav.topnav-one-line.topnav-sticky') && files.previewCss.includes('grid-template-columns: minmax(88px, max-content) minmax(0, 1fr)')],
  ['public landing keeps topnav loop disabled', files.previewCss.includes('.public-landing-viewport .topnav-menu-loop .top-menu-track') && files.previewCss.includes('animation: none !important') && files.previewCss.includes('.public-landing-viewport .top-menu-set-copy')],
  ['map widget has bounded embed area', files.previewCss.includes('.inlet-map-section') && /min-height|aspect-ratio/.test(files.previewCss)],
  ['faq content has vertical spacing', files.previewCss.includes('.faq-widget') && files.previewCss.includes('gap:')],
  ['widget box options render visible background and shadow', files.previewCss.includes('background:var(--widget-bg') && files.previewCss.includes('.landing-section.widget-shadow-on') && !/\.landing-section\.widget-shadow-on\s*\{[^}]*box-shadow:\s*none/i.test(files.previewCss)],
  ['theme-owned widgets ignore redundant shared surface values', files.content.includes('widgetBoxClass(s, { background: false, shadow: false })') && (files.info.match(/background: false, shadow: false/g) || []).length === 3 && (files.signal.match(/background: false, shadow: false/g) || []).length === 2],
  ['timer and activity omit dead alignment classes', !files.signal.includes('align-${align}')],
  ['widget spacing and corner options reach final CSS', files.previewCss.includes('margin-top: var(--widget-margin') && files.previewCss.includes('margin-bottom: var(--widget-margin') && files.previewCss.includes('border-radius: var(--widget-radius')],
  ['hero and text typography sizes reach final CSS', files.previewCss.includes('.landing-section.hero.title-large h1') && files.previewCss.includes('.landing-section.hero.body-large p') && files.previewCss.includes('.landing-section.text.text-size-large h2') && files.previewCss.includes('.landing-section.text.text-size-large p')],
  ['legacy hero emphasis values remain render-compatible', files.content.includes("s.bold ? 'is-bold' : ''") && files.content.includes("s.underline ? 'is-underline' : ''") && files.previewCss.includes('.landing-section.hero.is-bold h1') && files.previewCss.includes('.landing-section.hero.is-underline h1')],
  ['legacy text emphasis values remain render-compatible', files.previewCss.includes('.landing-section.text.is-bold p') && files.previewCss.includes('.landing-section.text.is-underline p') && /\.landing-section\.text\.is-bold[^}]*font-weight:\s*950\s*!important/s.test(files.previewCss) && /\.landing-section\.text\.is-underline[^}]*text-decoration:\s*underline\s*!important/s.test(files.previewCss)],
  ['hero and text style panels omit rich-text emphasis duplicates', !files.widgetStyles.includes('label="제목 굵게"') && !files.widgetStyles.includes('label="제목 밑줄"') && !files.widgetStyles.includes('<ToggleRow label="굵게"') && !files.widgetStyles.includes('<ToggleRow label="밑줄"')],
  ['hero image controls keep concise labels', !files.heroImage.includes('description=')],
  ['card layouts and tones have distinct final CSS', files.previewCss.includes('.cards-stack .cards-grid') && files.previewCss.includes('.cards-steps .cards-item') && files.previewCss.includes('.cards-solid') && files.previewCss.includes('.cards-outline')],
  ['card editor omits the duplicate steps layout while legacy pages remain compatible', !files.widgetStyles.includes("{ value: 'steps', label: '순서' }") && files.content.includes("['grid','stack','steps']")],
  ['code apply preserves the selected widget height', !files.codeEditor.includes("height: 'auto'") && files.codeEditor.includes("set({ html: draft, css: '', js: '', runJs: false })")],
  ['search display keeps the live toggle without redundant helper copy', files.searchDisplay.includes('label="실시간 검색"') && !files.searchDisplay.includes('description=')],
  ['link alignment reaches item copy', files.previewCss.includes('.landing-section.links.align-center :is(.link-list-body, .link-card-body)') && files.previewCss.includes('.landing-section.links.align-right :is(.link-list-body, .link-card-body)')],
  ['download list alignment reaches item copy', files.previewCss.includes('.landing-section.download-widget.download-list.align-center .download-body') && files.previewCss.includes('.landing-section.download-widget.download-list.align-right .download-body')],
  ['schedule color controls reach renderer and final CSS', files.info.includes("'--schedule-accent': s.highlightColor") && files.info.includes("'--schedule-card': s.cardBgColor") && files.info.includes("'--schedule-text': s.textColor") && files.previewCss.includes('var(--schedule-accent)') && files.previewCss.includes('var(--schedule-card)') && files.previewCss.includes('var(--schedule-text)')],
  ['utility widgets keep geometry without misleading surface overrides', (files.utility.match(/widgetBoxClass\(s, \{ background: false, shadow: false \}\)/g) || []).length === 2 && files.utility.includes('widgetBoxVars(s)') && files.utility.includes('page-search-widget')],
  ['map height presets reach final CSS', files.previewCss.includes('.map-height-small iframe') && files.previewCss.includes('.map-height-large iframe')],
  ['FAQ layout presets stay visually distinct', files.previewCss.includes('.faq-card .faq-list details') && files.previewCss.includes('.faq-plain .faq-list details')],
  ['FAQ style default matches the renderer contract', files.widgetStyles.includes("value={s.layout || 'accordion'}") && files.info.includes("s.layout || 'accordion'")],
  ['common editor fields omit redundant helper copy', !files.conciseEditorCopy.includes('description=')],
  ['search layout presets stay visually distinct', files.previewCss.includes('.page-search-bar') && files.previewCss.includes('.page-search-minimal')],
  ['code height presets reach final CSS', files.previewCss.includes('.code-height-small') && files.previewCss.includes('.code-height-medium') && files.previewCss.includes('.code-height-large')],
  ['topnav sticky defaults on and supports opt-out', files.layout.includes("s.sticky !== false ? 'topnav-sticky' : ''") && files.previewCss.includes('.topnav-one-line.topnav-sticky') && files.previewCss.includes('position: relative !important')],
  ['topnav alignment presets reach preview and public CSS', files.previewCss.includes('.topnav-one-line.topnav-align-center .top-menu') && files.previewCss.includes('.public-landing-viewport .topnav.topnav-one-line.topnav-align-right')],
  ['footer alignment and backgrounds reach final CSS', files.layout.includes('landing-footer footer-') && files.layout.includes('align-') && files.previewCss.includes('.footer-soft') && files.previewCss.includes('.footer-dark')],
  ['bottom CTA uses one direct-color toggle while preserving custom rendering', files.widgetStyles.includes('label="직접 색상"') && files.widgetStyles.includes("buttonColorMode: value ? 'custom' : 'theme'") && files.landing.includes("const customButtonColor = s.buttonColorMode === 'custom'") && files.previewCss.includes('.public-bottom-bar.bottom-custom-color button')],
  ['divider alignment appears only when width changes its position', files.dividerEditor.includes('width < 100 &&') && files.dividerEditor.includes('label="정렬"')],
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
assert(files.formEmbed.includes('data-pagero-page=') && files.formEmbed.includes('data-pagero-form-id=') && !files.formEmbed.includes('data-pagero-project-id="${escapeHtml(safePage.projectId)}"') && !files.formEmbed.includes('type="application/json"'), 'standalone form embed should prefer a short slug/form loader');
assert(files.formEmbed.includes('if (safePage.slug)') && files.formEmbed.includes('const formAttr = formId ?'), 'standalone form embed should stay short even when the form id is missing');
assert(files.formEmbed.includes('<script src="${DEFAULT_EMBED_SCRIPT_URL}" data-pagero-page=') && !files.formEmbed.includes('<div data-pagero-page='), 'standalone form embed should generate a single short script tag');
assert(files.publicFormEmbed.includes("var API_URL = HOME_URL + '/api/leads'") || files.publicFormEmbed.includes('https://pagero.kr/api/leads'), 'standalone form embed loader should submit to Pagero lead API');
assert(files.publicFormEmbed.includes('decodeConfig') && files.publicFormEmbed.includes("script.getAttribute('data-pagero')"), 'standalone form embed loader should keep inline compact config compatibility');
assert(files.publicFormEmbed.includes('fetchPublicFormConfig') && files.publicFormEmbed.includes("script.getAttribute('data-page')") && files.publicFormEmbed.includes("script.getAttribute('data-pagero-project-id')"), 'standalone form embed loader should fetch saved public page config from short embed attrs and keep legacy project attrs optional');
assert(files.publicFormEmbed.includes('function slugFromNode') && files.publicFormEmbed.includes("node.getAttribute('data-pagero-slug')") && files.publicFormEmbed.includes("node.getAttribute('data-page-slug')") && files.publicFormEmbed.includes("node.getAttribute('data-pagero-form-embed')"), 'standalone form embed loader should accept compact slug aliases on scripts and div targets');
assert(files.publicFormEmbed.includes('function formIdFromNode') && files.publicFormEmbed.includes('function projectIdFromNode'), 'standalone form embed loader should share form/project attribute parsing across script and div targets');
assert(files.publicFormEmbed.includes('function fetchPublicPage') && files.publicFormEmbed.includes("fetch(publicPageUrl(slug, ''), publicPageFetchOptions())"), 'standalone form embed loader should fall back to slug-only public page lookup');
assert(files.publicFormEmbed.includes('fresh=') && files.publicFormEmbed.includes("cache: 'no-store'"), 'standalone form embed loader should bypass cached public page config');
assert(!files.publicFormEmbed.includes("'Cache-Control'") && !files.publicFormEmbed.includes('Pragma'), 'standalone form embed loader must avoid custom request headers that trigger CORS preflight');
assert(files.publicFormEmbed.includes('data-pagero-page') && files.publicFormEmbed.includes('data-pagero-project-id') && files.publicFormEmbed.includes('initElement'), 'standalone form embed loader should support div + script embed targets with optional project identity');
assert(files.publicFormEmbed.includes("document.querySelectorAll('[data-pagero-page], [data-pagero-slug], [data-page-slug], [data-pagero-project-id], [data-pagero-form-embed]')"), 'standalone form embed loader should auto-init all supported compact div targets');
assert(!files.publicFormEmbed.includes('!payload.project.projectId || !payload.project.slug'), 'standalone form embed submit should not require project id when a slug is available');
assert(files.formEmbed.includes('projectId: safePage.projectId'), 'standalone form embed should include the page project id');
assert(files.formEmbed.includes('slug: safePage.slug'), 'standalone form embed should include the page slug');
assert(files.publicFormEmbed.includes('answers: extracted.answers'), 'standalone form embed should preserve structured answers');
assert(files.publicFormEmbed.includes('function readJsonSafe') && files.publicFormEmbed.includes('function submitErrorMessage') && files.publicFormEmbed.includes('\\uBC18\\uBCF5 \\uC811\\uC218\\uB85C'), 'standalone form embed should map submit failures to user-safe messages');
assert(!/\?\?/.test(files.publicFormEmbed), 'standalone form embed should not contain mojibake fallback question marks');
assert(files.form.includes('function digitsOnly') && files.form.includes('inputMode="numeric"') && files.form.includes('pattern="[0-9]*"'), 'preview form phone fields should force numeric input');
assert(files.publicFormEmbed.includes('data-pagero-phone="1"') && files.publicFormEmbed.includes('inputmode="numeric"') && files.publicFormEmbed.includes('digitsOnly(firstAnswer'), 'standalone form phone fields should force and submit numeric input');
assert(files.publicFormEmbed.includes('\\uC811\\uC218 \\uC800\\uC7A5\\uC5D0 \\uC2E4\\uD328'), 'standalone form embed should show server save failure');
assert(files.publicFormEmbed.includes('\\uD398\\uC774\\uC9C0\\uB85C\\uB85C \\uC81C\\uC791') && files.publicFormEmbed.includes('sourceLabel'), 'standalone form embed should show Pagero credit and preserve attribution');
assert(files.formEditor.includes("label: '스타일'") && files.formDesign.includes('buttonColorMode') && files.formDesign.includes('buttonTextColor') && !files.formDesign.includes('buttonHover'), 'form editor should keep mobile-relevant button shape and color controls without hover-only settings');
assert(files.formEditor.includes("label: '제출'") && files.formSubmission.includes('duplicatePhone') && files.formSubmission.includes('duplicateEmail') && files.formSubmission.includes('duplicateWindow'), 'form editor should expose submission duplicate policies after the component split');
assert(files.form.includes("'--form-button': themeButtonColor(s)") && files.form.includes("'--form-button-hover': themeButtonHoverColor(s)") && files.previewCss.includes('.form-button-hover-fill') && files.previewCss.includes('.form-input-underline'), 'form design controls should map button colors, hover effects, and input styles into preview contracts');
assert(files.form.includes('form-align-${textAlign} align-${textAlign}') && files.previewCss.includes('.reservation-v2.form-button-hover-zoom') && files.previewCss.includes('color: var(--form-button-text, #fff)'), 'reservation styles should preserve shared alignment and custom hover color contracts');
assert(files.imageDisplay.includes("value: 'original'") && files.imageDisplay.includes("value: 'fill'") && files.imageDisplay.includes('rounded'), 'image editor should expose original, fill, and rounded display controls');
assert(files.imageGallery.includes('galleryShowArrows') && files.imageGallery.includes('galleryShowDots') && files.imageGallery.includes('interval'), 'gallery editor should expose navigation and autoplay timing controls');
assert(!files.imageGallery.includes('description='), 'gallery style controls should stay concise without redundant helper copy');
assert(files.media.includes('image-${display}') && files.media.includes('galleryShowArrows') && files.media.includes('galleryShowDots') && files.media.includes("'--block-margin'"), 'image renderer should consume display, gallery navigation, and spacing settings');
assert(files.previewCss.includes('.image-sec .image-wrap.image-original img') && files.previewCss.includes('.image-sec .image-wrap.image-fill img') && files.previewCss.includes('.gallery-arrows') && files.previewCss.includes('.dots'), 'image and gallery CSS should consume renderer display and navigation classes');
assert(files.widgetStyles.includes('timerTheme') && files.widgetStyles.includes('label="움직임"') && files.widgetStyles.includes("urgentStyle: value ? 'flow' : 'none'") && files.signal.includes('timer-theme-${theme}') && files.signal.includes('timer-effect-${effect}'), 'timer style controls should expose only the working flow animation toggle while preserving renderer compatibility');
assert(files.widgetStyles.includes('label="목록 움직임"') && files.widgetStyles.includes("animation: value ? 'stack' : 'none'") && files.signal.includes('activity-anim-${anim}') && files.previewCss.includes('.activity-anim-none .activity-live-dot'), 'activity movement toggle should map to renderer classes and fully stop animation');
assert(files.widgetStyles.includes('<Color label="강조색"') && !files.widgetStyles.includes('<Color label="카드 배경"') && !files.widgetStyles.includes('<Color label="글자색"'), 'schedule style controls should keep the useful accent color while inheriting card and text colors from the page theme');
assert(!files.widgetStyles.includes('WidgetSurfaceControls') && !files.widgetStyles.includes('label="위아래 여백"') && !files.widgetStyles.includes('label="모서리"') && !files.widgetStyles.includes('label="그림자 추가"'), 'widget style panels should keep only widget-specific controls and content alignment');
assert(!files.previewCss.includes('form-button-anim-') && !files.previewCss.includes('form-button-overlay'), 'form button effects should use the single buttonHover contract');
assert(files.browserVisualQa.includes("INLET_BROWSER_QA_EXTRA_URLS=auto"), 'browser visual QA should document automatic footer/legal route coverage');
assert(files.browserVisualQa.includes("'/privacy'") && files.browserVisualQa.includes("'/terms'"), 'browser visual QA auto routes should cover legal pages');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_STATE_PRESET'), 'browser visual QA should support authenticated state presets');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_AUTH_SESSION') && files.browserVisualQa.includes('INLET_BROWSER_QA_AUTH_WORKSPACE_ID'), 'browser visual QA should support an external authenticated session without hardcoded credentials');
assert(files.browserVisualQa.includes('owner-settings') && files.browserVisualQa.includes('client-settings') && files.browserVisualQa.includes('manager-limited'), 'browser visual QA should include owner, client admin, and manager authenticated presets');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_CLICK_TEXT'), 'browser visual QA should support post-navigation interaction checks');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_CLICK_SELECTOR'), 'browser visual QA should support precise selector interaction checks');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_POST_CLICK_SELECTOR'), 'browser visual QA should support submit/save clicks after input mutation');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_SET_INPUT'), 'browser visual QA should support input mutation checks');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_RICH_FORMAT'), 'browser visual QA should support rich text toolbar formatting checks');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_EXPECT_COMPUTED'), 'browser visual QA should support computed-style checks');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_EXPECT_TEXT'), 'browser visual QA should assert authenticated screen text');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_FORBID_TEXT'), 'browser visual QA should assert forbidden text is absent');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_VIEWPORTS'), 'browser visual QA should allow desktop-only authenticated checks');
assert(files.browserVisualQa.includes('--window-size=1280,900'), 'local Chrome visual QA should launch with a desktop-sized window');
assert(files.workspaceShellActions.includes("if (['topnav', 'bottombar', 'footer'].includes(target?.type))") && /setOpenId\(''\);\r?\n\s+return;/.test(files.workspaceShellActions), 'preview fixed blocks should not auto-open editor panels');
assert(/setOpenId\(''\);\r?\n\s+setAddOpen\(false\);/.test(files.workspaceShellActions) && files.fixedBlockSelection.includes("React.useState('')") && files.pageGlobalOptionsProps.includes('openId: selection.fixedOpenId'), 'edit entry should keep fixed block panels closed until explicitly opened');
assert(!/[�]|占|獄|揆|\?몄|\?꾩|蹂듭|遺덈|紐|釉|湲|肄/.test(files.editPanel), 'edit panel source should not contain mojibake labels');
const productionBrowserQa = await readFile('scripts/production-browser-quality-check.mjs', 'utf8');
assert(productionBrowserQa.includes('owner style text color live preview'), 'production browser QA should cover style text color live preview');
assert(productionBrowserQa.includes('owner style font tone live preview') && productionBrowserQa.includes('.landing-page.font-bold.font-family-serif'), 'production browser QA should cover style font/tone live preview');
assert(productionBrowserQa.includes('owner rich text bold underline toolbar') && productionBrowserQa.includes('INLET_BROWSER_QA_RICH_FORMAT'), 'production browser QA should cover rich text bold/underline toolbar formatting');
assert(productionBrowserQa.includes('owner server save round trip') && productionBrowserQa.includes('INLET_PRODUCTION_QA_SAVE_POST_CLICK_SELECTOR'), 'staging browser QA should support an explicit authenticated save round trip');

console.log(JSON.stringify({
  ok: true,
  checks: requiredDispatch.length + rendererContracts.length * 2 + cssContracts.length + visualGeometryContracts.length + viewportContracts.length + previewSourceEntries.length * 2 + 33,
  visualGeometryChecks: visualGeometryContracts.length,
  viewportContracts: viewportContracts.length,
}, null, 2));
