import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rendererCss = await readFile('src/preview/LandingRenderer.css', 'utf8');
const parityCss = await readFile('src/styles/preview-runtime-parity.css', 'utf8');
const fixedUiCss = await readFile('src/styles/preview-fixed-ui-contract.css', 'utf8');
const workspacePreview = await readFile('src/screens/workspace/WorkspacePreviewPane.jsx', 'utf8');
const app = await readFile('src/App.jsx', 'utf8');
const baseCss = await readFile('src/styles/base.css', 'utf8');
const editorWorkspaceCss = await readFile('src/styles/editor-workspace-v2.css', 'utf8');
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
assert(app.includes('className="public-landing-viewport"'), 'Public landing route must keep the public runtime host');
assert(baseCss.includes('*{box-sizing:border-box}'), 'Runtime width parity depends on border-box sizing');
assert(editorWorkspaceCss.includes('width: 430px !important') && editorWorkspaceCss.includes('border: 8px solid #111827 !important'), 'Editor phone frame must keep a 414px inner viewport');
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
assert(fixedUiCss.includes('padding-bottom: calc(max(88px, var(--page-fixed-bottom-height, 0px)) + 14px) !important'), 'Final fixed UI contract must prefer measured bottom height over the legacy fixed reserve');
assert(fixedUiCss.includes('scroll-padding-bottom: calc(max(88px, var(--page-fixed-bottom-height, 0px)) + 14px) !important'), 'Anchor scrolling must reserve measured fixed action space');
assert(!parityCss.includes('@media (max-width: 420px)'), 'Runtime parity must use container width instead of the browser viewport width');

console.log(JSON.stringify({
  ok: true,
  check: 'preview-public-css-parity',
  runtimeWidth: 414,
  usesContainerQueries: true,
  publicBottomContained: true,
  fixedUiContractLoadedLast: true,
}, null, 2));
