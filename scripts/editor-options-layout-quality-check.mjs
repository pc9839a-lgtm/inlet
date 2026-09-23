import { access, readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pageOptions = await readFile('src/editor/editPanelParts/PageGlobalOptions.jsx', 'utf8');
const pageOptionsHeader = await readFile('src/editor/editPanelParts/PageGlobalOptionsHeader.jsx', 'utf8');
const pageOptionsList = await readFile('src/editor/editPanelParts/PageGlobalOptionsList.jsx', 'utf8');
const pageOptionsProps = await readFile('src/editor/editPanelSectionProps/pageGlobalOptionsProps.js', 'utf8');
const fixedBlocksProps = await readFile('src/editor/editPanelSectionProps/fixedBlocksProps.js', 'utf8');
const fixedBlocks = await readFile('src/editor/editPanelParts/GlobalFixedBlocks.jsx', 'utf8');
const fixedBlockHeader = await readFile('src/editor/editPanelParts/FixedBlockCardHeader.jsx', 'utf8');
const editorControls = await readFile('src/editor/editPanelParts/editorControls.jsx', 'utf8');
const fixedBlocksCss = await readFile('src/editor/editPanelParts/FixedBlocksSection.css', 'utf8');
const pageOptionsCss = await readFile('src/editor/editPanelParts/PageGlobalOptions.css', 'utf8');
const shareCard = await readFile('src/editor/editPanelParts/ShareOptionsCard.jsx', 'utf8');
const shareCss = await readFile('src/editor/editPanelParts/ShareOptionsCard.css', 'utf8');
const screenOrderHeader = await readFile('src/editor/editPanelParts/ScreenOrderListHeader.jsx', 'utf8');
const screenOrderCss = await readFile('src/editor/editPanelParts/ScreenOrder.css', 'utf8');
const editorLabels = await readFile('src/editor/editPanelParts/editorLabels.js', 'utf8');
const editLayout = await readFile('src/editor/EditPanelLayout.jsx', 'utf8');
const sectionProps = await readFile('src/editor/createEditPanelSectionProps.js', 'utf8');
const mobileScreenOrderCss = screenOrderCss.slice(screenOrderCss.indexOf('@media (max-width: 760px)'));
const editorFinalCleanCss = await readFile('src/styles/editor-final-clean.css', 'utf8');
const screenOrderPolishCss = await readFile('src/styles/editor-screen-order-polish.css', 'utf8');
const legacyScreenOrderTokens = [
  '.screen-order-card',
  '.screen-order-list',
  '.screen-order-item',
  '.screen-order-inline-editor',
  '.screen-order-head',
  '.screen-title-wrap',
  '.screen-order-number',
  '.screen-row-chevron',
  '.screen-row-visibility',
  '.screen-row-actions',
  '.screen-row-action-menu',
  '.screen-drag-handle',
  '.screen-on-toggle',
  '.screen-more-action',
];

async function assertMissingFile(relativePath) {
  try {
    await access(relativePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`legacy editor source must stay removed: ${relativePath}`);
}

assert(pageOptions.includes("import './PageGlobalOptions.css';"), 'page options must load its compact layout owner');
assert(pageOptionsCss.includes('max-width: 100%') && pageOptionsCss.includes('overflow-x: hidden'), 'page options must clamp nested editor width and horizontal overflow');
assert(pageOptionsCss.includes('@media (max-width: 760px)') && pageOptionsCss.includes('padding: 10px'), 'page options must keep a dedicated mobile card layout');
assert(!pageOptionsList.includes('GlobalFixedBlocks'), 'page options must not render fixed block editors');
assert(pageOptionsList.includes('AnimationOptionsCard') && pageOptionsList.includes('ShareOptionsCard'), 'page options must retain global animation and share controls');
assert(!pageOptionsProps.includes('topNavBlock') && !pageOptionsProps.includes('bottomBlock') && !pageOptionsProps.includes('footerBlock'), 'page option props must stay global-only');
assert(fixedBlocksProps.includes('topNavBlock: selection.topNavBlock') && fixedBlocksProps.includes('bottomBlock: selection.bottomBlock') && fixedBlocksProps.includes('footerBlock: selection.footerBlock'), 'fixed block props must own top, bottom, and footer editors');
assert(sectionProps.includes('fixedBlocksProps: createFixedBlocksProps'), 'edit panel section props must expose fixed blocks separately');
assert(editLayout.includes('<GlobalFixedBlocks {...fixedBlocksProps} />'), 'screen order mode must own the fixed block editor group');
assert(editLayout.includes('aria-label="고정 영역"') && editLayout.includes('<h2>고정 영역</h2>'), 'fixed blocks must be clearly labeled outside page options');
assert(fixedBlocks.includes("import './FixedBlocksSection.css';"), 'fixed block group must load its own styles after leaving page options');
assert(fixedBlocksCss.includes('.screen-order-fixed-blocks .fixed-block-card') && fixedBlocksCss.includes('.screen-order-fixed-blocks .fixed-block-editor'), 'fixed block section must own card and editor layout');
assert(fixedBlocksCss.includes('@media (max-width: 760px)') && fixedBlocksCss.includes('.fixed-block-copy em'), 'fixed block section must retain compact mobile behavior');
assert(!shareCard.includes('<em>공개 페이지 공유 버튼</em>'), 'share option must not repeat an explanatory subtitle');
assert(shareCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'mobile share position choices must use a readable 2x2 grid');
assert(shareCss.includes('min-height: 42px'), 'mobile share position choices must keep large tap targets');
assert(screenOrderCss.includes('@media (max-width: 760px)') && screenOrderCss.includes('.screen-order-v2-card { padding: 10px;'), 'screen order must retain its compact mobile card contract');
assert(editLayout.includes('edit-section-tabs') && editLayout.includes('화면 순서') && editLayout.includes('<ScreenOrderList {...screenOrderListProps} />'), 'screen order must live in the restored left editor flow');
assert(editLayout.includes('페이지 옵션') && editLayout.includes('<PageGlobalOptions {...pageGlobalOptionsProps} />') && editLayout.includes('<PageThemeStylePanel {...stylePanelProps} />'), 'page options and theme controls must live in the restored left editor mode');
assert(editorLabels.includes("globalSettings: '\\uC804\\uC5ED \\uC124\\uC815'") && pageOptionsHeader.includes('T.globalSettings'), 'page options content heading must be global settings instead of repeating the tab label');
assert(editorLabels.includes("normalBlocks: '\\uC77C\\uBC18 \\uBE14\\uB85D'") && screenOrderHeader.includes('T.normalBlocks'), 'screen order content heading must identify normal blocks instead of repeating the tab label');
assert(mobileScreenOrderCss.includes('grid-template-columns: 44px minmax(0,1fr) 44px 44px'), 'mobile screen order must reserve full touch columns without horizontal overflow');
assert(/\.screen-order-v2-drag\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s.test(mobileScreenOrderCss), 'mobile drag handle must expose a 44px touch target');
assert(/\.screen-order-v2-visibility-button,[\s\S]*?\.screen-order-v2-action\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s.test(mobileScreenOrderCss), 'mobile visibility and action controls must expose 44px touch targets');
assert(fixedBlockHeader.includes('className="fixed-block-switch"'), 'fixed block visibility switch must have a scoped mobile hit-target class');
assert(editorControls.includes("className = ''") && editorControls.includes('className ?'), 'shared Switch must accept an optional scoped class without changing other switch callers');
assert(/\.fixed-open-button\s*\{[^}]*width:\s*44px\s*!important;[^}]*height:\s*44px\s*!important;/s.test(fixedBlocksCss), 'mobile fixed block open button must expose a 44px touch target');
assert(/\.fixed-block-switch\s*\{[^}]*height:\s*44px\s*!important;[\s\S]*?\.fixed-block-switch::before\s*\{[^}]*height:\s*28px\s*!important;/s.test(fixedBlocksCss), 'fixed block switch must keep a 44px hit target while preserving the compact 28px visual track');
assert(screenOrderCss.includes('.screen-order-v2-item') && screenOrderCss.includes('.screen-order-v2-head') && screenOrderCss.includes('.screen-order-v2-menu'), 'screen order V2 stylesheet must remain the normal-block layout owner');
assert(legacyScreenOrderTokens.every((token) => !editorFinalCleanCss.includes(token)), 'editor-final-clean must not restore legacy normal-block selectors');
assert(legacyScreenOrderTokens.every((token) => !screenOrderPolishCss.includes(token)), 'editor-screen-order-polish must not restore legacy normal-block selectors');
assert(['.screen-icon-action', '.fixed-open-button', '.switch-clean', '.fixed-block-head'].every((token) => editorFinalCleanCss.includes(token)), 'current shared fixed-block controls must remain styled after legacy cleanup');
await assertMissingFile('src/editor/editPanelParts/ScreenOrderRowActionMenu.jsx');
await assertMissingFile('src/editor/editPanelParts/screenOrderRowMenuItems.js');
await assertMissingFile('src/editor/editPanelParts/useScreenOrderRowMenu.js');

console.log(JSON.stringify({
  ok: true,
  scope: 'editor-options-layout',
  checks: 35,
  saveFlowTouched: false,
  globalOptionsSeparated: true,
  unifiedPageThemeInspector: true,
  fixedBlocksMovedToScreenOrder: true,
  fixedBlockStylesOwned: true,
  hierarchyLabelsDistinct: true,
  mobileTouchTargetPx: 44,
  mobileOverflowGuard: true,
  largeMobileControls: true,
  fixedBlockMobileTouchTargetPx: 44,
  fixedBlockSwitchVisualTrackPx: 28,
  legacyScreenOrderCssRemoved: true,
  legacyScreenOrderMenuSourcesRemoved: true,
}, null, 2));
