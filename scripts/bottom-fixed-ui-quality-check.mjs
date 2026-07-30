import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const renderer = await readFile('src/preview/LandingRenderer.jsx', 'utf8');
const fixedUiCss = await readFile('src/styles/preview-fixed-ui-contract.css', 'utf8');
const rendererCss = await readFile('src/preview/LandingRenderer.css', 'utf8');

assert(renderer.includes("const [fixedUiHeights, setFixedUiHeights] = useState({ top: 0, bottom: 0 })"), 'LandingRenderer must retain measured fixed UI heights');
assert(renderer.includes('new ResizeObserver(measure)') && renderer.includes("'--page-fixed-bottom-height'"), 'LandingRenderer must measure and expose the rendered bottom bar height');
assert(renderer.includes("window.visualViewport?.addEventListener('resize', syncFromActiveElement)"), 'Form focus handling must react to the mobile visual viewport');

assert(fixedUiCss.includes('scroll-padding-bottom: calc(max(88px, var(--page-fixed-bottom-height, 0px)) + 14px)'), 'Landing runtime must keep anchor targets above measured fixed actions');
assert(fixedUiCss.includes('.landing-page.has-bottom-bar .page-share-button.position-bottom-left'), 'Bottom share controls must offset above the measured bottom bar');
assert(fixedUiCss.includes('.bottom-bar:has(.bottom-timer)'), 'Timer and button combinations must use the compact density contract');
assert(fixedUiCss.includes('.bottom-bar.count-3'), 'Three-button bars must receive a compact layout');
assert(fixedUiCss.includes('@container pagero-landing (max-width: 370px)'), 'Small landing containers must keep a dedicated bottom action contract');
assert(fixedUiCss.includes('env(safe-area-inset-bottom, 0px)'), 'Small-screen bottom actions must retain safe-area padding');

const fixedUiImport = "@import '../styles/preview-fixed-ui-contract.css';";
assert(rendererCss.includes(fixedUiImport) && rendererCss.indexOf(fixedUiImport) === rendererCss.lastIndexOf('@import '), 'Bottom fixed UI contract must remain the final preview stylesheet');

console.log(JSON.stringify({
  ok: true,
  check: 'bottom-fixed-ui',
  measuredReserve: true,
  shareCollisionGuard: true,
  compactTimerButtons: true,
  safeAreaAware: true,
}, null, 2));
