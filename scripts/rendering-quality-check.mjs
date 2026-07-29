import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const previewCssFiles = [
  'src/styles/base-components.css',
  'src/styles/base-components-image.css',
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
  'src/styles/preview-form-focus-fixed-ui.css',
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
  'src/styles/preview-workspace-timer-minimal.css',
  'src/styles/preview-workspace-timer-solid-variants.css',
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
  'src/styles/preview-workspace-topnav-balance.css',
  'src/styles/preview-workspace-effects-widgets.css',
  'src/styles/preview-widget-style-options.css',
  'src/styles/preview-workspace-effects-map-faq.css',
  'src/styles/preview-public.css',
  'src/styles/preview-bottom-share.css',
];

const files = {
  landing: await readFile('src/preview/LandingRenderer.jsx', 'utf8'),
  landingCss: await readFile('src/preview/LandingRenderer.css', 'utf8'),
  animationCard: await readFile('src/editor/editPanelParts/AnimationOptionsCard.jsx', 'utf8'),
  animationPlayback: await readFile('src/editor/editPanelParts/AnimationPlaybackOptions.jsx', 'utf8'),
  fixedBlockBody: await readFile('src/editor/editPanelParts/FixedBlockCardBody.jsx', 'utf8'),
  shareOptions: await readFile('src/editor/editPanelParts/ShareOptionsCard.jsx', 'utf8'),
  pageModel: await readFile('src/lib/pageModel.js', 'utf8'),
  editorWorkspaceCss: await readFile('src/styles/editor-workspace-v2.css', 'utf8'),
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
  mapEditor: await readFile('src/editor/blockEditors/MapEditor.jsx', 'utf8'),
  mapTransit: await readFile('src/editor/blockEditors/MapTransitSection.jsx', 'utf8'),
  link: await readFile('src/preview/renderers/LinkBlocks.jsx', 'utf8'),
  media: await readFile('src/preview/renderers/MediaBlocks.jsx', 'utf8'),
  signal: await readFile('src/preview/renderers/SignalBlocks.jsx', 'utf8'),
  timerEditor: await readFile('src/editor/blockEditors/TimerEditor.jsx', 'utf8'),
  timerBasic: await readFile('src/editor/blockEditors/TimerBasicSection.jsx', 'utf8'),
  layout: await readFile('src/preview/renderers/LayoutBlocks.jsx', 'utf8'),
  widgetStyles: await readFile('src/editor/blockEditors/WidgetStylePanels.jsx', 'utf8'),
  heroImage: await readFile('src/editor/blockEditors/HeroImageSection.jsx', 'utf8'),
  dividerEditor: await readFile('src/editor/blockEditors/DividerEditor.jsx', 'utf8'),
  utility: await readFile('src/preview/renderers/UtilityBlocks.jsx', 'utf8'),
  formEmbed: await readFile('src/lib/formEmbed.js', 'utf8'),
  publicFormEmbed: await readFile('public/embed/form.js', 'utf8'),
  timerVariantCss: await readFile('src/styles/preview-workspace-timer-solid-variants.css', 'utf8'),
  previewCss: (await Promise.all(previewCssFiles.map((file) => readFile(file, 'utf8')))).join('\n'),
  cssQa: await readFile('scripts/css-quality-check.mjs', 'utf8'),
  browserVisualQa: await readFile('scripts/browser-visual-quality-check.mjs', 'utf8'),
};

new Function(files.publicFormEmbed);

const requiredDispatch = [
  'topnav', 'hero', 'image', 'text', 'map', 'faq', 'links', 'download', 'timer',
  'activity', 'spacer', 'divider', 'code', 'search', 'form', 'reservation', 'footer',
];
for (const type of requiredDispatch) {
  assert(files.landing.includes(`block.type==='${type}'`), `LandingRenderer dispatch missing ${type}`);
}

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

assert(files.landing.indexOf("block.type==='topnav'") < files.landing.indexOf("block.type==='hero'"), 'topnav should render before hero');
assert(files.landing.includes('BlockErrorBoundary'), 'block error boundary should wrap preview blocks');
assert(files.landing.includes('installConversionTracking(page)') && files.landing.includes('if (templatePreview) return;'), 'conversion tracking should skip template preview');
assert(files.landing.includes("page.theme.animPlayback === 'loop'") && files.landing.includes('prepareForReentry'), 'animation loop should replay on viewport re-entry');
assert(files.animationCard.includes('updateTheme({ animPlayback })') && files.animationPlayback.includes('ANIMATION_PLAYBACK_OPTIONS'), 'animation playback editor contract missing');

assert(files.layout.includes('RollingMenuLabel') && files.layout.includes('s.menus.slice(0, 5)'), 'topnav should cap five menus and measure rolling labels');
assert(files.layout.includes("'--top-menu-count': String(menuCount)"), 'topnav should expose menu count to CSS');
assert(files.previewCss.includes('grid-template-columns: repeat(var(--top-menu-count), minmax(0, 1fr))'), 'topnav should distribute available width evenly');
assert(files.previewCss.includes('.topnav-one-line.topnav-menu-count-1') && files.previewCss.includes('.topnav-one-line.topnav-menu-count-5'), 'topnav should have one/five item balance rules');
assert(files.previewCss.includes('.top-menu-label.is-overflowing') && files.previewCss.includes('@keyframes top-menu-label-roll'), 'long topnav labels should roll only when overflowing');

assert(files.landing.includes("typeof navigator.share === 'function'"), 'native share capability check missing');
assert(files.landing.includes('navigator.canShare(payload)') && files.landing.includes("if (error?.name === 'AbortError') return"), 'native share support/cancel handling missing');
assert(files.landing.includes("https://pagero.kr/${encodeURIComponent(slug)}"), 'share URL should use canonical Pagero public URL');
assert(files.shareOptions.includes('top-left') && files.shareOptions.includes('top-right') && files.shareOptions.includes('bottom-left') && files.shareOptions.includes('bottom-right'), 'share editor should expose four positions');
assert(files.pageModel.includes("['top-left','top-right','bottom-left','bottom-right']"), 'share positions should persist through page normalization');
assert(files.previewCss.includes('.page-share-button.position-top-left') && files.previewCss.includes('.page-share-button.position-bottom-right'), 'share position CSS missing');

assert(files.landing.includes('isFormInputControl') && files.landing.includes('formInputActive'), 'form focus mode detection missing');
assert(files.landing.includes('hiddenForForm={formInputActive}') && files.landing.includes('is-form-input-active'), 'fixed UI should hide while form controls are focused');
assert(files.landing.includes('window.setTimeout(syncFromActiveElement, 140)'), 'form blur should be delayed to prevent flicker');
assert(files.previewCss.includes('.landing-page.is-form-input-active') && files.previewCss.includes('.bottom-bar.is-form-input-hidden'), 'form focus fixed UI transition CSS missing');

assert(!files.signal.includes('timer-headline') && !files.signal.includes('timer-cta'), 'timer should render numbers only');
assert(files.signal.includes('timer-variant-${variant}') && files.signal.includes('timer-palette-${palette}') && files.signal.includes('timer-motion-${motion}'), 'timer renderer should consume variant, palette, and motion');
assert(files.timerBasic.includes('TIMER_VARIANT_OPTIONS') && files.timerBasic.includes('TIMER_PALETTE_OPTIONS') && files.timerBasic.includes('timerMotion'), 'timer editor should expose style, color, and motion controls');
assert(files.pageModel.includes("timerVariant: ['minimal','flat','block','line','point']") && files.pageModel.includes("timerPalette: ['ink','blue','green','coral','accent']"), 'timer variants should persist through normalization');
for (const variant of ['minimal', 'flat', 'block', 'line', 'point']) {
  assert(files.previewCss.includes(`.landing-section.timer.timer-variant-${variant}`), `timer CSS missing ${variant} variant`);
}
assert(!files.timerVariantCss.includes('linear-gradient'), 'timer variant stylesheet should remain solid-color');
assert(files.previewCss.includes('@media (prefers-reduced-motion: reduce)') && files.previewCss.includes('timer-motion-on'), 'timer motion should respect reduced motion');

const cssContracts = [
  '.landing-page', '.landing-content', '.landing-section', '.hero', '.form', '.reservation-v2',
  '.faq-widget', '.schedule-widget', '.bottom-bar', '.inlet-map-section', '.image-sec', '.links',
  '.download-widget', '.timer', '.activity', '.landing-footer', '.block-render-fallback',
];
for (const selector of cssContracts) {
  assert(files.previewCss.includes(selector), `preview css missing ${selector}`);
}

assert(/\.form[\s\S]*input[\s\S]*width:\s*100%|\.form input[\s\S]*width:\s*100%/.test(files.previewCss), 'form fields should use full width');
assert(files.form.includes('duplicatePrompt') && files.form.includes('requestDuplicateSubmit'), 'duplicate submit inline prompt missing');
assert(files.form.includes('inputMode="numeric"') && files.form.includes('pattern="[0-9]*"'), 'phone fields should force numeric input');
assert(files.previewCss.includes('.reservation-v2') && files.previewCss.includes('grid-template-columns: 1fr'), 'reservation mobile fallback missing');
assert(files.previewCss.includes('.public-landing-viewport') && files.previewCss.includes('width: min(414px, 100vw)'), 'public landing should match 414px preview canvas');
assert(files.previewCss.includes('bottom-bar.count-3') && files.previewCss.includes('repeat(3'), 'bottom bar three-button tracks missing');
assert(!/\.bottom-bar\.count-3\s*\{[^}]*repeat\(2/i.test(files.previewCss), 'bottom bar count-3 must not collapse to two columns');

assert(files.mapEditor.includes("label: '교통'") && files.mapEditor.includes('MapTransitSection'), 'map transit tab missing');
assert(files.mapTransit.includes('showSubway') && files.mapTransit.includes('showBus') && files.mapTransit.includes('showParking'), 'map transit controls missing');
assert(files.info.includes('location-guide-actions') && files.info.includes('location-guide-transit'), 'map transit renderer missing');
assert(files.previewCss.includes('.map-height-small iframe') && files.previewCss.includes('.map-height-large iframe'), 'map height presets missing');
assert(files.previewCss.includes('.faq-card .faq-list details') && files.previewCss.includes('.faq-plain .faq-list details'), 'FAQ layout styles missing');

assert(files.imageDisplay.includes("value: 'original'") && files.imageDisplay.includes("value: 'fill'") && files.imageDisplay.includes('rounded'), 'image display controls missing');
assert(files.imageGallery.includes('galleryGridCount') && files.imageGallery.includes('galleryShowArrows') && files.imageGallery.includes('galleryShowDots'), 'gallery display controls missing');
assert(files.media.includes('gallery.slice(0, gridCount)') && files.media.includes('image-gallery-grid-${visibleGallery.length}'), 'gallery renderer contract missing');
assert(files.previewCss.includes('.image-gallery-grid-4') && files.previewCss.includes('.gallery-arrows') && files.previewCss.includes('.dots'), 'gallery CSS missing');

assert(files.widgetStyles.includes('set({ logoSize: value })') && files.widgetStyles.includes('set({ menuStyle: value })') && files.widgetStyles.includes('set({ sticky: value })'), 'topnav editor controls missing');
assert(files.widgetStyles.includes('BottomBarStylePanel') && files.landing.includes("s.buttonColorMode === 'custom'"), 'bottom bar style/color contract missing');
assert(files.widgetStyles.includes('label="목록 움직임"') && files.signal.includes('activity-anim-${anim}'), 'activity movement contract missing');
assert(files.codeEditor.includes("set({ html: draft, css: '', js: '', runJs: false })"), 'code apply should preserve selected height');
assert(files.searchDisplay.includes('label="실시간 검색"'), 'search live toggle missing');
assert(files.dividerEditor.includes('width < 100 &&') && files.dividerEditor.includes('label="정렬"'), 'divider conditional alignment missing');

const sourceEntries = Object.entries(files).filter(([name]) => name !== 'previewCss');
for (const [name, source] of sourceEntries) {
  assert(!/\b(?:window\.)?(?:alert|confirm)\s*\(/.test(source), `preview source must not use alert/confirm: ${name}`);
}
const runtimeEntries = sourceEntries.filter(([name]) => name !== 'cssQa');
for (const [name, source] of runtimeEntries) {
  assert(!/[�]|占|獄|揆|\?몄|\?꾩|蹂듭|遺덈|紐|釉|湲|肄/.test(source), `preview source contains mojibake: ${name}`);
}
assert(!/[�]|占|獄|揆/.test(files.previewCss), 'preview css contains mojibake');
assert(!files.previewCss.includes('position: absolute;\n  position: fixed;'), 'preview css contains position override collision');
assert(files.cssQa.includes('catchAllFileBaselines'), 'css QA focused ownership baseline missing');

assert(files.formEmbed.includes('https://pagero.kr/embed/form.js'), 'standalone form embed URL missing');
assert(files.formEmbed.includes('data-pagero-page=') && files.formEmbed.includes('data-pagero-form-id='), 'compact form embed attributes missing');
assert(files.publicFormEmbed.includes('fetchPublicFormConfig') && files.publicFormEmbed.includes('answers: extracted.answers'), 'public form loader config/answers contract missing');
assert(files.publicFormEmbed.includes("cache: 'no-store'") && !files.publicFormEmbed.includes("'Cache-Control'"), 'public form loader cache/CORS contract missing');

assert(files.browserVisualQa.includes('INLET_BROWSER_QA_TEMPLATE_ROUTES'), 'browser QA template route support missing');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_STATE_PRESET') && files.browserVisualQa.includes('owner-settings'), 'browser QA authenticated presets missing');
assert(files.browserVisualQa.includes('INLET_BROWSER_QA_SET_INPUT') && files.browserVisualQa.includes('INLET_BROWSER_QA_EXPECT_COMPUTED'), 'browser QA interaction/computed checks missing');
assert(files.workspaceShellActions.includes("if (['topnav', 'bottombar', 'footer'].includes(target?.type))"), 'fixed block selection guard missing');
assert(files.fixedBlockSelection.includes("React.useState('')") && files.pageGlobalOptionsProps.includes('openId: selection.fixedOpenId'), 'fixed editor selection state contract missing');

const productionBrowserQa = await readFile('scripts/production-browser-quality-check.mjs', 'utf8');
assert(productionBrowserQa.includes('owner style text color live preview'), 'production browser QA text color check missing');
assert(productionBrowserQa.includes('owner rich text bold underline toolbar'), 'production browser QA rich text check missing');
assert(productionBrowserQa.includes('owner server save round trip'), 'production browser QA save round trip missing');

console.log(JSON.stringify({
  ok: true,
  dispatchChecks: requiredDispatch.length,
  rendererChecks: rendererContracts.length * 2,
  cssContracts: cssContracts.length,
  sourceChecks: sourceEntries.length * 2,
}, null, 2));
