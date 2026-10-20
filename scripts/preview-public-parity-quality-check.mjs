import { createPreviewPage, getEditorDraftPreviewPage, isEditorPreviewSafeMediaBlock, simulateEditorPreviewLead, visiblePreviewBlocks, previewUrlForPage } from '../src/runtime/previewTarget.js';
import { usePreviewWindow } from '../src/runtime/usePreviewWindow.js';
import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rendererCss = await readFile('src/preview/LandingRenderer.css', 'utf8');
const parityCss = await readFile('src/styles/preview-runtime-parity.css', 'utf8');
const fixedUiCss = await readFile('src/styles/preview-fixed-ui-contract.css', 'utf8');
const workspacePreview = await readFile('src/screens/workspace/WorkspacePreviewPane.jsx', 'utf8');
const workspaceScreen = await readFile('src/screens/WorkspaceEditorScreen.jsx', 'utf8');
const app = await readFile('src/App.jsx', 'utf8');
const baseCss = await readFile('src/styles/base.css', 'utf8');
const workspacePreviewCss = await readFile('src/screens/workspace/WorkspacePreviewPane.css', 'utf8');
const publicCss = await readFile('src/styles/preview-public.css', 'utf8');

const parityImport = "@import '../styles/preview-runtime-parity.css';";
const fixedUiImport = "@import '../styles/preview-fixed-ui-contract.css';";
const parityImportIndex = rendererCss.indexOf(parityImport);
const fixedUiImportIndex = rendererCss.indexOf(fixedUiImport);
const lastImportIndex = rendererCss.lastIndexOf('@import ');

assert(parityImportIndex >= 0, 'LandingRenderer must load the preview/public parity stylesheet');
assert(fixedUiImportIndex > parityImportIndex, 'Fixed UI collision rules must load after the base parity stylesheet');
assert(fixedUiImportIndex === lastImportIndex, 'Fixed UI collision contract must be the final imported preview stylesheet');
assert(workspacePreview.includes("import PreviewRenderer from '../../preview/LandingRenderer.jsx'"), 'Editor preview must use LandingRenderer');
assert(app.includes("import PreviewRenderer from './preview/LandingRenderer.jsx'"), 'Public landing route must use LandingRenderer');
assert(workspacePreview.includes('className="phone-frame"'), 'Editor preview must keep the phone-frame runtime host');
assert(!workspacePreview.includes('showConversionCockpit') && !workspacePreview.includes('onOpenInbox') && !workspacePreview.includes('onOpenStats') && !workspaceScreen.includes('showConversionCockpit='), 'Retired preview management toolbar props must not be forwarded');
assert(!workspacePreviewCss.includes('.preview-top') && !workspacePreviewCss.includes('100dvh - 144px') && !workspacePreviewCss.includes('100dvh - 110px'), 'Removed preview chrome must not leave CSS or reserved vertical space');
assert(workspacePreviewCss.includes('height: calc(100dvh - 56px) !important') && workspacePreviewCss.includes('min-height: 0 !important'), 'Non-edit preview should use all available viewport height without a hidden header reserve');
assert(app.includes('className="public-landing-viewport"'), 'Public landing route must keep the public runtime host');
assert(baseCss.includes('*{box-sizing:border-box}'), 'Runtime width parity depends on border-box sizing');
assert(workspacePreview.includes("import './WorkspacePreviewPane.css';"), 'WorkspacePreviewPane must load its component-owned preview CSS');
assert(workspacePreviewCss.includes('width: 430px !important') && workspacePreviewCss.includes('border: 8px solid #111827 !important'), 'Editor phone frame must keep a 414px inner viewport under WorkspacePreviewPane.css ownership');
assert(publicCss.includes('width: min(414px, 100vw)') || publicCss.includes('max-width: 414px'), 'Public runtime must keep the 414px viewport contract');

for (const token of [
  '.phone-frame,\n.public-landing-viewport',
  'container-name: pagero-landing',
  'container-type: inline-size',
  '.phone-frame > .landing-page,',
  '.public-landing-viewport .landing-page',
  'scrollbar-width: none',
  '.phone-frame .landing-content,',
  '.public-landing-viewport .landing-content',
  '.phone-frame .landing-content > .topnav.topnav-sticky,',
  '.public-landing-viewport .landing-content > .topnav.topnav-sticky',
  '.phone-frame .bottom-bar {',
  '.public-landing-viewport .public-bottom-bar {',
  '@container pagero-landing (max-width: 420px)',
  '@container pagero-landing (max-width: 370px)',
]) {
  assert(parityCss.includes(token), `Preview/public parity stylesheet missing ${token}`);
}

const publicBottomRule = parityCss.match(/\.public-landing-viewport \.public-bottom-bar \{([\s\S]*?)\}/)?.[1] || '';
assert(publicBottomRule.includes('position: absolute !important'), 'Public bottom bar must be positioned against the 414px public landing viewport');
assert(publicBottomRule.includes('left: 0 !important') && publicBottomRule.includes('right: 0 !important'), 'Public bottom bar must be pinned to both sides of the public landing viewport');
assert(publicBottomRule.includes('bottom: 0 !important'), 'Public bottom bar must stay pinned to the bottom of the public landing viewport');
assert(publicBottomRule.includes('width: 100% !important') && publicBottomRule.includes('max-width: 100% !important'), 'Public bottom bar width must resolve inside the public landing viewport');
assert(!publicBottomRule.includes('position: fixed'), 'Public bottom bar must not resolve 100% width against the desktop browser viewport');
assert(parityCss.includes('.public-landing-viewport .public-bottom-bar.is-form-input-hidden') && parityCss.includes('transform: translateY(calc(100% + 18px)) !important'), 'Public bottom bar form-focus hiding must preserve the contained positioning model');

assert(parityCss.includes('grid-template-columns: 44px minmax(0, 1fr) !important'), '414px runtime containers must receive the mobile top navigation layout');
assert(parityCss.includes('grid-template-columns: repeat(var(--bottom-button-count, 2), minmax(0, 1fr)) !important'), 'Preview and public bottom actions must use the same button grid');
assert(fixedUiCss.includes('padding-bottom: calc(max(88px, var(--page-fixed-bottom-height, 0px)) + 10px) !important'), 'Final fixed UI contract must prefer measured bottom height with a compact reserve');
assert(fixedUiCss.includes('scroll-padding-bottom: calc(max(88px, var(--page-fixed-bottom-height, 0px)) + 10px) !important'), 'Anchor scrolling must reserve measured fixed action space without excess padding');
assert(!parityCss.includes('@media (max-width: 420px)'), 'Runtime parity must use container width instead of the browser viewport width');


// Execute the media allowlist against stored video blocks. Ordinary code and
// third-party embeds are not permitted to run inside editor previews.
const localVideo = { type: 'code', s: { widgetMode: 'youtube', videoUrl: 'http://localhost:4174/api/files/download?key=project%2Fvideos%2Fdemo.mp4' } };
const testOrigin = 'http://localhost:4174';
assert(isEditorPreviewSafeMediaBlock(localVideo, testOrigin), 'editor preview must retain same-origin library video playback/metadata');
assert(!isEditorPreviewSafeMediaBlock(localVideo, 'http://other.example'), 'cross-origin preview must not load this file');
assert(!isEditorPreviewSafeMediaBlock({ type: 'code', s: { widgetMode: 'youtube', videoUrl: 'https://external.example/video.mp4' } }, testOrigin), 'external video must stay isolated');
assert(!isEditorPreviewSafeMediaBlock({ type: 'code', s: { widgetMode: 'youtube', videoUrl: 'https://youtu.be/xYz12345678' } }, testOrigin), 'third-party iframe must stay blocked in editor');
assert(!isEditorPreviewSafeMediaBlock({ type: 'code', s: { widgetMode: 'custom', html: '<script>alert(1)</script>' } }, testOrigin), 'custom code must not execute in editor');
assert(!isEditorPreviewSafeMediaBlock({ type: 'code', s: { widgetMode: 'youtube', videoUrl: 'http://localhost:4174/random.mp4' } }, testOrigin), 'untrusted same-origin paths must not bypass the allowlist');

// Editor draft preview and public landing share the renderer but must NOT
// share write, delivery, analytics, or publish side effects.
const previewRenderer = await readFile('src/preview/LandingRenderer.jsx', 'utf8');
const previewModal = await readFile('src/builder/BuilderFeedback.jsx', 'utf8');
const previewWindowSource = await readFile('src/runtime/usePreviewWindow.js', 'utf8');
const previewSource = await readFile('src/screens/workspace/WorkspacePreviewPane.jsx', 'utf8');

const draftPage = { title: '비공개 초안', slug: 'draft-qa', theme: { accent: '#123456' }, blocks: [
  { id: 'text-a', type: 'text', visible: true },
  { id: 'hero-b', type: 'hero', visible: true },
  { id: 'nav-c', type: 'topnav', visible: true },
  { id: 'bottom-d', type: 'bottombar', visible: true },
] };
const visible = visiblePreviewBlocks(draftPage);
assert(visible.map((block) => block.id).join(',') === 'text-a,hero-b,nav-c,bottom-d', 'Visible blocks must retain user ordering');
assert(previewRenderer.includes('const normal = blocks.filter(b=>b.type!==\'bottombar\');'), 'Normal landing blocks must not hoist HERO or navigation');
assert(previewRenderer.includes('visiblePreviewBlocks(page)'), 'Landing renderer must use the tested block order model');
const preview = createPreviewPage({ page: draftPage, stylePreviewTheme: { accent: '#abcdef' }, mapSiteId: 'test-map' });
assert(preview !== draftPage && getEditorDraftPreviewPage() === preview, 'Current unsaved draft must be available to header preview');
assert(preview.theme.accent === '#abcdef' && preview.blocks[0].id === 'text-a', 'Pending style and block changes must reach draft preview');
assert(previewUrlForPage(draftPage).includes('draft-qa'), 'Published URL remains a separate, explicit destination');
let openedCount = 0;
let copiedIssue = null;
let warned = 0;
const existingWindow = globalThis.window;
globalThis.window = { open: () => { openedCount += 1; return null; } };
try {
  usePreviewWindow({
    previewUrl: 'https://pagero.kr/draft-qa',
    setPreviewCopyIssue: (issue) => { copiedIssue = issue; },
    showToast: () => { warned += 1; },
  }).openPreview();
  assert(copiedIssue?.kind === 'draft' && copiedIssue.page === preview, 'Header preview must show unsaved draft, not published URL');
  assert(copiedIssue.publishedUrl === 'https://pagero.kr/draft-qa', 'Published destination must remain separately available');
  assert(openedCount === 0 && warned === 0, 'Draft action must not open public URL or misdiagnose a noopener null return');
} finally {
  globalThis.window = existingWindow;
}
const lead = { name: '모의 이름', isTest: false };
const simulated = await simulateEditorPreviewLead(lead);
assert(lead.isTest === true && simulated.isTest === true, 'Form submission object must carry isTest=true before legacy conversion guard');
assert(previewSource.includes('editorPreview') && !previewSource.includes('addLead={addLead}') && !previewSource.includes('track={track}'), 'Editor canvas must not receive production callbacks');
assert(previewRenderer.includes('editorPreview ? simulateEditorPreviewLead : addLead'), 'Editor mode must select mocked lead action');
assert(previewRenderer.includes('editorPreview ? undefined : track'), 'Editor mode must block analytics callbacks');
assert(previewRenderer.includes('templatePreview || editorPreview') && previewRenderer.includes('installConversionTracking(page)'), 'Editor mode must not install conversion pixels');
assert(previewRenderer.includes('if (!editorPreview && !templatePreview) track?.'), 'Editor mode must not track page views');
assert(previewRenderer.includes('if (editorPreview && (target === \'url\' || target === \'phone\')) return;'), 'External actions must be inert in draft previews');
assert(previewRenderer.includes("if(block.type==='code')return editorPreview"), 'Arbitrary JS/widget code must be disabled in draft preview');
assert(previewModal.includes('현재 초안 미리보기') && previewModal.includes('발행본 보기'), 'Draft and published views must be distinguishable');
assert(previewModal.includes('rel="noopener noreferrer"') && previewModal.includes('target="_blank"'), 'Published links must retain noopener security');
assert(previewModal.includes("navigator.clipboard.writeText(url)") && previewModal.includes('onClick={copyPreviewUrl}'), 'Retry copy must perform clipboard write rather than open a window');
assert(!previewWindowSource.includes('window.open('), 'Header preview must not guess popup blocking from noopener null');
assert(workspacePreviewCss.includes('.editor-draft-preview-dialog'), 'Draft preview overlay must be sized independently of page publishing');

console.log(JSON.stringify({
  ok: true,
  check: 'preview-public-css-parity',
  runtimeWidth: 414,
  usesContainerQueries: true,
  publicBottomContained: true,
  fixedUiContractLoadedLast: true,
  measuredBottomReserveExtra: 10,
}, null, 2));
