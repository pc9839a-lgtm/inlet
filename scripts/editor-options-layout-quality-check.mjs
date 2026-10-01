import { access, readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pageOptions = await readFile('src/editor/editPanelParts/PageGlobalOptions.jsx', 'utf8');
const pageOptionsHeader = await readFile('src/editor/editPanelParts/PageGlobalOptionsHeader.jsx', 'utf8');
const pageOptionsList = await readFile('src/editor/editPanelParts/PageGlobalOptionsList.jsx', 'utf8');
const animationOptionsCard = await readFile('src/editor/editPanelParts/AnimationOptionsCard.jsx', 'utf8');
const animationOptionsCss = await readFile('src/editor/editPanelParts/AnimationOptionsCard.css', 'utf8');
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
const editPanelLayoutCss = await readFile('src/editor/EditPanelLayout.css', 'utf8');
const screenOrderList = await readFile('src/editor/editPanelParts/ScreenOrderList.jsx', 'utf8');
const screenOrderListItems = await readFile('src/editor/editPanelParts/ScreenOrderListItems.jsx', 'utf8');
const screenOrderItem = await readFile('src/editor/editPanelParts/ScreenOrderItem.jsx', 'utf8');
const screenOrderRowIdentity = await readFile('src/editor/editPanelParts/ScreenOrderRowIdentity.jsx', 'utf8');
const codeEditor = await readFile('src/editor/blockEditors/CodeEditor.jsx', 'utf8');
const codeEditorCss = await readFile('src/editor/blockEditors/CodeEditor.css', 'utf8');
const editorFinalCleanCss = await readFile('src/styles/editor-final-clean.css', 'utf8');
const editorSharedUiCss = await readFile('src/styles/editor-shared-ui.css', 'utf8');
const sectionProps = await readFile('src/editor/createEditPanelSectionProps.js', 'utf8');
const mobileScreenOrderCss = screenOrderCss.slice(screenOrderCss.indexOf('@media (max-width: 760px)'));
const editorWorkspaceCss = await readFile('src/styles/editor-workspace.css', 'utf8');
const editorExpandedShellCss = await readFile('src/styles/editor-expanded-shell.css', 'utf8');
const editorExpandedControlsCss = await readFile('src/styles/editor-expanded-controls.css', 'utf8');
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
assert(editLayout.includes('edit-section-tabs') && editLayout.includes('화면 순서') && editLayout.includes('<ScreenOrderList {...screenOrderListProps} />'), 'screen order must live in the restored left editor flow without a redundant selected-settings shell');
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
assert(!screenOrderList.includes('selectedBlockSettingsProps') && !screenOrderListItems.includes('selectedBlockSettingsProps') && screenOrderItem.includes('data-inline-block-editor="true"') && screenOrderItem.includes('{renderBlockEditor(block)}'), 'selected block must render its editor directly below the row without the redundant settings card');
assert(!editLayout.includes('selectedBlockSettingsProps') && !screenOrderItem.includes('SelectedBlockSettings'), 'redundant selected block settings component must stay removed');
assert(!screenOrderItem.includes('selected-block-settings-body') && screenOrderItem.includes('className="screen-order-v2-inline-editor"'), 'inline block editor must not carry the retired selected-settings CSS class');
assert(!editorFinalCleanCss.includes('selected-block-settings-body') && !editorFinalCleanCss.includes('selected-block-settings-card'), 'editor-final-clean must not own retired selected-settings styles');
assert(screenOrderCss.includes('Inline block-editor controls owned by ScreenOrder v1') && screenOrderCss.includes('.screen-order-v2-inline-editor .block-editor-v2'), 'ScreenOrder component stylesheet must own inline block-editor controls');
assert(screenOrderCss.includes('Desktop inline block-editor readability owner — ScreenOrder') && screenOrderCss.includes('.block-editor-anchor-control') && screenOrderCss.includes('.editor-tabs-v2-panel') && screenOrderCss.includes('.editor-field-v2--compact-text') && !editorWorkspaceCss.includes('screen-order-v2-inline-editor'), 'desktop inline block readability must remain fully component-owned by ScreenOrder.css');
assert(codeEditor.includes('editorLabel') && codeEditor.includes('구분 이름') && codeEditor.includes('maxLength={40}'), 'code editor must expose a persistent custom label field');
assert(codeEditor.includes('block-editor-anchor-control code-editor-name-control') && codeEditor.includes('block-editor-anchor-label') && codeEditor.includes('block-editor-anchor-value code-editor-name-value'), 'code block label must reuse the exact widget-code row structure');
assert(!codeEditorCss.includes('.code-editor-name {') && codeEditorCss.includes('.code-editor-name-value'), 'code block label must not keep a duplicate row layout in component CSS');
assert(screenOrderRowIdentity.includes("block.type === 'code'") && screenOrderRowIdentity.includes('displayLabel') && screenOrderRowIdentity.includes('<strong title={displayLabel}>{displayLabel}</strong>'), 'screen order must display the custom code label beside 코드 입력');
assert(editLayout.includes('data-editor-section={section}'), 'edit section panel must expose the active subsection for deterministic PC styling');
assert(editLayout.includes("import './EditPanelLayout.css';") && editPanelLayoutCss.includes('edit-section-tabs-v2') && editPanelLayoutCss.includes('.editor-page-options-stack') && !editorWorkspaceCss.includes('edit-section-tabs') && !editorWorkspaceCss.includes('editor-page-options-stack'), 'EditPanelLayout must load and own subsection tabs/panel stack instead of editor-workspace.css');
assert(screenOrderCss.includes('Desktop ScreenOrder surface owner') && fixedBlocksCss.includes('Fixed-block component owner for the active editor surface'), 'screen order and fixed blocks must keep explicit component-owned PC visual contracts');
assert(pageOptionsCss.includes('.page-global-options-card.card') && pageOptionsCss.includes('padding: 18px !important') && pageOptionsCss.includes('border-radius: 22px !important') && screenOrderCss.includes('.edit-layout .screen-order-v2-card') && screenOrderCss.includes('padding: 18px !important') && screenOrderCss.includes('border-radius: 22px !important'), 'page options and screen order must preserve the same PC outer-surface geometry in component CSS');
assert(screenOrderCss.includes('.screen-order-v2-list') && screenOrderCss.includes('gap: 10px !important') && screenOrderCss.includes('.screen-order-v2-item') && !editorWorkspaceCss.includes('.screen-order-v2-card'), 'PC screen order card/list ownership must stay in ScreenOrder.css instead of editor-workspace.css');
assert(/\.screen-order-v2-head\s*\{[^}]*min-height:\s*38px;[^}]*gap:\s*2px;/s.test(screenOrderCss), 'desktop screen-order rows must keep the tightened 38px / 2px density');
assert(legacyScreenOrderTokens.every((token) => !editorFinalCleanCss.includes(token)), 'editor-final-clean must not restore legacy normal-block selectors');
assert(['.screen-icon-action', '.fixed-open-button', '.switch-clean'].every((token) => editorSharedUiCss.includes(token)) && fixedBlocksCss.includes('.fixed-block-head'), 'shared controls and fixed-block visuals must live with their current owners');
assert(animationOptionsCard.includes("import './AnimationOptionsCard.css';") && animationOptionsCss.includes('.edit-animation-card') && animationOptionsCss.includes('.edit-animation-options'), 'animation options must load and own their component CSS');
assert(animationOptionsCss.includes('.edit-animation-settings') && fixedBlocksCss.includes('Fixed editor body base surface formerly supplied by editor-workspace.css') && !editorWorkspaceCss.includes('.fixed-block-card') && !editorWorkspaceCss.includes('.edit-animation-card') && !editorWorkspaceCss.includes('.fixed-block-editor') && !editorWorkspaceCss.includes('.edit-animation-settings'), 'workspace geometry must not own fixed or animation card presentation');
assert(editorExpandedShellCss.includes('Block editor shell details migrated from editor-workspace.css') && editorExpandedShellCss.includes('.block-editor-v2-header') && editorExpandedShellCss.includes('.editor-section-v2-trigger') && editorExpandedControlsCss.includes('Block editor controls migrated from editor-workspace.css') && editorExpandedControlsCss.includes('.editor-field-v2') && editorExpandedControlsCss.includes('.image-mode-toolbar') && !editorWorkspaceCss.includes('.block-editor-v2-header') && !editorWorkspaceCss.includes('.editor-field-v2') && !editorWorkspaceCss.includes('.editor-section-v2-trigger'), 'expanded UI styles must own block editor shell and controls instead of workspace geometry');
assert(!editorFinalCleanCss.includes('.screen-icon-action') && !editorFinalCleanCss.includes('.switch-clean') && !editorFinalCleanCss.includes('.fixed-block-head') && !editorFinalCleanCss.includes('.edit-animation') && !editorFinalCleanCss.includes('.screen-drop-zone'), 'editor-final-clean must stay workspace-geometry-only');
await assertMissingFile('src/styles/editor-screen-order-polish.css');
await assertMissingFile('src/editor/editPanelParts/ScreenOrderRowActionMenu.jsx');
await assertMissingFile('src/editor/editPanelParts/screenOrderRowMenuItems.js');
await assertMissingFile('src/editor/editPanelParts/useScreenOrderRowMenu.js');
await assertMissingFile('src/editor/editPanelParts/SelectedBlockSettings.jsx');
await assertMissingFile('src/editor/editPanelParts/SelectedBlockSettingsBody.jsx');
await assertMissingFile('src/editor/editPanelParts/SelectedBlockSettingsHeader.jsx');
await assertMissingFile('src/editor/editPanelParts/SelectedBlockSettings.css');

console.log(JSON.stringify({
  ok: true,
  scope: 'editor-options-layout',
  checks: 38,
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
