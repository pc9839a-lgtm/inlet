import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const renderer = await readFile('src/preview/LandingRenderer.jsx', 'utf8');
const parityCss = await readFile('src/styles/preview-runtime-parity.css', 'utf8');
const rendererCss = await readFile('src/preview/LandingRenderer.css', 'utf8');

assert(renderer.includes("root.closest?.('.public-landing-viewport')"), 'Public bottom bar measurement must stay scoped to its landing viewport');
assert(renderer.includes("'--page-fixed-bottom-fallback'"), 'LandingRenderer must expose a first-paint bottom reserve fallback');
assert(renderer.includes("has-timer") && renderer.includes("has-buttons") && renderer.includes("buttons-${btns.length}"), 'Bottom bar must expose timer/button density classes');
assert(renderer.includes("data-bottom-button-count={btns.length}"), 'Bottom bar must expose its rendered button count');

assert(parityCss.includes('scroll-padding-bottom: calc(max(var(--page-fixed-bottom-fallback'), 'Landing runtime must keep anchor targets above fixed actions');
assert(parityCss.includes('.landing-page.has-bottom-bar .page-share-button.position-bottom-left'), 'Bottom share controls must offset above the measured bottom bar');
assert(parityCss.includes('.bottom-bar.has-timer.has-buttons'), 'Timer and button combinations must use the compact density contract');
assert(parityCss.includes('.bottom-bar.buttons-3'), 'Three-button bars must receive a compact layout');
assert(parityCss.includes('@container pagero-landing (max-width: 370px)'), 'Small landing containers must keep a dedicated bottom action contract');
assert(!parityCss.includes('padding-bottom: calc(max(112px, var(--page-fixed-bottom-height'), 'Bottom reserve must not keep the old fixed 112px assumption');

const parityImport = "@import '../styles/preview-runtime-parity.css';";
assert(rendererCss.includes(parityImport) && rendererCss.indexOf(parityImport) === rendererCss.lastIndexOf('@import '), 'Bottom fixed UI contract must remain in the final preview stylesheet');

console.log(JSON.stringify({
  ok: true,
  check: 'bottom-fixed-ui',
  measuredReserve: true,
  shareCollisionGuard: true,
  compactTimerButtons: true,
}, null, 2));
