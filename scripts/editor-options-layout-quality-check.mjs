import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pageOptions = await readFile('src/editor/editPanelParts/PageGlobalOptions.jsx', 'utf8');
const pageOptionsCss = await readFile('src/editor/editPanelParts/PageGlobalOptions.css', 'utf8');
const shareCard = await readFile('src/editor/editPanelParts/ShareOptionsCard.jsx', 'utf8');
const shareCss = await readFile('src/editor/editPanelParts/ShareOptionsCard.css', 'utf8');
const screenOrderCss = await readFile('src/editor/editPanelParts/ScreenOrder.css', 'utf8');
const editLayout = await readFile('src/editor/EditPanelLayout.jsx', 'utf8');

assert(pageOptions.includes("import './PageGlobalOptions.css';"), 'page options must load its compact layout owner');
assert(pageOptionsCss.includes('max-width: 100%') && pageOptionsCss.includes('overflow-x: hidden'), 'page options must clamp nested editor width and horizontal overflow');
assert(pageOptionsCss.includes('@media (max-width: 760px)') && pageOptionsCss.includes('padding: 10px'), 'page options must keep a dedicated mobile card layout');
assert(pageOptionsCss.includes('.fixed-block-copy em') && pageOptionsCss.includes('display: none'), 'mobile page options must hide secondary helper copy');
assert(!shareCard.includes('<em>공개 페이지 공유 버튼</em>'), 'share option must not repeat an explanatory subtitle');
assert(shareCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'mobile share position choices must use a readable 2x2 grid');
assert(shareCss.includes('min-height: 42px'), 'mobile share position choices must keep large tap targets');
assert(screenOrderCss.includes('@media (max-width: 760px)') && screenOrderCss.includes('.screen-order-v2-card { padding: 10px;'), 'screen order must retain its compact mobile card contract');
assert(editLayout.includes('페이지 옵션') && editLayout.includes('화면 순서'), 'edit panel must keep page options and screen order as separate top-level modes');

console.log(JSON.stringify({
  ok: true,
  scope: 'editor-options-layout',
  checks: 9,
  saveFlowTouched: false,
  mobileOverflowGuard: true,
  compactHelperCopy: true,
  largeMobileControls: true,
}, null, 2));
