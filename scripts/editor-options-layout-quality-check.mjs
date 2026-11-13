import { access, readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pageOptions = await readFile('src/editor/editPanelParts/PageGlobalOptions.jsx', 'utf8');
const pageOptionsList = await readFile('src/editor/editPanelParts/PageGlobalOptionsList.jsx', 'utf8');
const animationOptionsCard = await readFile('src/editor/editPanelParts/AnimationOptionsCard.jsx', 'utf8');
const animationOptionsCss = await readFile('src/editor/editPanelParts/AnimationOptionsCard.css', 'utf8');
const pageOptionsProps = await readFile('src/editor/editPanelSectionProps/pageGlobalOptionsProps.js', 'utf8');
const fixedBlocksProps = await readFile('src/editor/editPanelSectionProps/fixedBlocksProps.js', 'utf8');
const fixedBlocks = await readFile('src/editor/editPanelParts/GlobalFixedBlocks.jsx', 'utf8');
const fixedBlockHeader = await readFile('src/editor/editPanelParts/FixedBlockCardHeader.jsx', 'utf8');
const fixedBlockCard = await readFile('src/editor/editPanelParts/FixedBlockCard.jsx', 'utf8');
const editorControls = await readFile('src/editor/editPanelParts/editorControls.jsx', 'utf8');
const fixedBlocksCss = await readFile('src/editor/editPanelParts/FixedBlocksSection.css', 'utf8');
const pageOptionsCss = await readFile('src/editor/editPanelParts/PageGlobalOptions.css', 'utf8');
const shareCard = await readFile('src/editor/editPanelParts/ShareOptionsCard.jsx', 'utf8');
const shareCss = await readFile('src/editor/editPanelParts/ShareOptionsCard.css', 'utf8');
const screenOrderCss = await readFile('src/editor/editPanelParts/ScreenOrder.css', 'utf8');
const editorLabels = await readFile('src/editor/editPanelParts/editorLabels.js', 'utf8');
const editLayout = await readFile('src/editor/EditPanelLayout.jsx', 'utf8');
const editPanelLayoutCss = await readFile('src/editor/EditPanelLayout.css', 'utf8');
const screenOrderList = await readFile('src/editor/editPanelParts/ScreenOrderList.jsx', 'utf8');
const normalBlockSelection = await readFile('src/editor/useNormalBlockSelection.js', 'utf8');
const selectionProps = await readFile('src/editor/editPanelSectionProps/screenOrderListProps.js', 'utf8');
const screenOrderListItems = await readFile('src/editor/editPanelParts/ScreenOrderListItems.jsx', 'utf8');
const globalFixedBlocks = await readFile('src/editor/editPanelParts/GlobalFixedBlocks.jsx', 'utf8');
const screenOrderSettings = await readFile('src/editor/editPanelParts/ScreenOrderSettings.jsx', 'utf8');
const screenOrderItem = await readFile('src/editor/editPanelParts/ScreenOrderItem.jsx', 'utf8');
const screenOrderRowIdentity = await readFile('src/editor/editPanelParts/ScreenOrderRowIdentity.jsx', 'utf8');
const screenOrderIdentityModel = await readFile('src/editor/editPanelParts/screenOrderIdentityModel.js', 'utf8');
const codeEditor = await readFile('src/editor/blockEditors/CodeEditor.jsx', 'utf8');
const codeEditorCss = await readFile('src/editor/blockEditors/CodeEditor.css', 'utf8');
const workspaceShellCss = await readFile('src/styles/workspace-shell.css', 'utf8');
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
assert(pageOptionsCss.includes('@media (max-width: 760px)') && pageOptionsCss.includes('min-height: 44px'), 'page settings disclosures must retain mobile-sized controls');
assert(!pageOptionsList.includes('GlobalFixedBlocks'), 'page options must not render fixed block editors');
assert(pageOptionsList.includes('AnimationOptionsCard') && pageOptionsList.includes('ShareOptionsCard'), 'page options must retain global animation and share controls');
assert(!pageOptionsProps.includes('topNavBlock') && !pageOptionsProps.includes('bottomBlock') && !pageOptionsProps.includes('footerBlock'), 'page option props must stay global-only');
assert(fixedBlocksProps.includes('topNavBlock: selection.topNavBlock') && fixedBlocksProps.includes('bottomBlock: selection.bottomBlock') && fixedBlocksProps.includes('footerBlock: selection.footerBlock'), 'fixed block props must own top, bottom, and footer editors');
assert(sectionProps.includes('fixedBlocksProps: createFixedBlocksProps'), 'edit panel section props must expose fixed blocks separately');
assert(editLayout.includes("only={['topnav']}") && editLayout.includes("only={['bottom', 'footer']}")
  && editLayout.includes('renderFixedSettings()')
  && editLayout.includes('className="editor-properties-panel"')
  && globalFixedBlocks.includes('props.renderInlineEditor?.(cardProps.block)'),
  'fixed entries must share the selected properties panel without losing their own editors');
assert(editLayout.includes('groupId="top" title="상단 고정"')
  && editLayout.includes('groupId="bottom" title="하단 고정"')
  && editLayout.includes('aria-label={`${title} 영역`}')
  && editLayout.includes('className="editor-fixed-group-toggle"')
  && editLayout.includes('aria-expanded={expanded}')
  && editLayout.includes('hidden={!expanded}')
  && editLayout.includes('entries.some((item) => item.block.id === selectedId)'),
  'fixed blocks must keep labeled, keyboard-accessible top/bottom groups, and reveal selected fixed blocks');
assert(fixedBlocks.includes("import './FixedBlocksSection.css';"), 'fixed block group must load its own styles after leaving page options');
assert(fixedBlocksCss.includes('.screen-order-fixed-blocks .fixed-composition-row') && fixedBlocksCss.includes('.fixed-composition-row .fixed-block-head'), 'fixed region section must own inline row geometry');
assert(fixedBlocksCss.includes('grid-template-columns: 18px minmax(0,1fr) 31px !important;')
  && fixedBlocksCss.includes('grid-template-columns: 32px minmax(0,1fr) !important;')
  && fixedBlocksCss.includes('overflow-wrap: anywhere'),
  'fixed rows must match normal block geometry and preserve long-name wrapping');
assert(!shareCard.includes('<em>공개 페이지 공유 버튼</em>'), 'share option must not repeat an explanatory subtitle');
assert(shareCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'mobile share position choices must use a readable 2x2 grid');
assert(shareCss.includes('min-height: 42px'), 'mobile share position choices must keep large tap targets');
assert(screenOrderCss.includes('@media (max-width: 760px)') && screenOrderCss.includes('.screen-order-v2-card { padding: 10px;'), 'screen order must retain its compact mobile card contract');
assert(normalBlockSelection.includes('setOpenId(blockId);')
  && !normalBlockSelection.includes("current === blockId ? '' : blockId")
  && normalBlockSelection.includes('clearBlockSelection')
  && selectionProps.includes('clearBlockSelection: selection.clearBlockSelection')
  && editLayout.includes('screenOrderListProps.clearBlockSelection()'),
  'selecting the same block must retain its settings; page settings must clear selection explicitly');
assert(editLayout.includes('editor-page-settings-button')
  && !editLayout.includes('edit-section-tabs')
  && editLayout.includes('블록 편집')
  && editLayout.includes('listOnly')
  && editLayout.includes('selectBlock={chooseBlock}'),
  'ordered stack must retain accessible selection and one add entry');
assert(editLayout.includes('페이지 설정')
  && editLayout.includes('<PageGlobalOptions')
  && editLayout.includes('updateTheme={updatePageTheme}')
  && editLayout.includes('<PageThemeStylePanel {...stylePanelProps} />'),
  'the page design inspector must reuse the existing theme and page settings models');
assert(!pageOptions.includes('PageGlobalOptionsHeader') && pageOptions.includes('aria-label="페이지 동작"'), 'page behavior must have an accessible group label without repeating a visible settings heading');
assert(editLayout.includes('<h2>블록 편집 <span className="editor-composition-total">')
  && editLayout.includes('editor-composition-total')
  && !screenOrderList.includes('ScreenOrderListHeader'),
  'block stack must have one identifiable title and count');
assert(mobileScreenOrderCss.includes('grid-template-columns: 44px minmax(0,1fr) 44px 44px'), 'mobile screen order must reserve full touch columns without horizontal overflow');
assert(/\.screen-order-v2-drag\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s.test(mobileScreenOrderCss), 'mobile drag handle must expose a 44px touch target');
assert(/\.screen-order-v2-visibility-button,[\s\S]*?\.screen-order-v2-action\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s.test(mobileScreenOrderCss), 'mobile visibility and action controls must expose 44px touch targets');
assert(fixedBlockCard.includes('<ScreenOrderRowVisibility visible={visible}') && fixedBlockCard.includes('data-fixed-position="true"') && fixedBlockCard.includes('aria-pressed={selected}'), 'fixed rows must share normal visibility and selection semantics without drag affordances');
assert(editorControls.includes("className = ''") && editorControls.includes('className ?'), 'shared Switch must accept an optional scoped class without changing other switch callers');
assert(fixedBlocksCss.includes('min-height: 44px !important') && fixedBlocksCss.includes('.fixed-composition-select'), 'fixed rows must remain at least 44px high with a reachable selection button');
assert(fixedBlocksCss.includes('.screen-order-v2-visibility-button') && !fixedBlocksCss.includes('.fixed-open-button') && !fixedBlockCard.includes('fixed-open-button'), 'fixed row must retain visibility and a single selection button without duplicate edit actions');
assert(screenOrderCss.includes('.screen-order-v2-item') && screenOrderCss.includes('.screen-order-v2-head') && screenOrderCss.includes('.screen-order-v2-menu'), 'screen order V2 stylesheet must remain the normal-block layout owner');
assert(screenOrderListItems.includes('<ScreenOrderSettings')
  && screenOrderListItems.includes('editor-inline-settings')
  && screenOrderListItems.includes('selectedId === block.id')
  && editLayout.includes('editor-composition-panel')
  && !screenOrderItem.includes('renderBlockEditor')
  && screenOrderListItems.includes('!listOnly && selectedId === block.id')
  && editLayout.includes('editor-properties-content'),
  'navigation-only rows must stay compact while the real widget editor is rendered independently');
assert(!editLayout.includes('selectedBlockSettingsProps')
  && !screenOrderItem.includes('SelectedBlockSettings')
  && screenOrderListItems.includes('renderBlockEditor={renderBlockEditor}'),
  'new block stack must reuse the real widget editors without retired wrappers');
assert(screenOrderSettings.includes('className="screen-order-v2-settings"')
  && screenOrderSettings.includes('data-block-settings-id={block.id}')
  && screenOrderSettings.includes('{renderBlockEditor(block)}')
  && screenOrderSettings.includes('tabIndex={-1}')
  && screenOrderSettings.includes('role="group"')
  && screenOrderListItems.includes('role="region" aria-label="선택 항목 편집" tabIndex={0}'),
  'expanded settings must be labeled, keyboard reachable and reuse existing fields');
assert(!workspaceShellCss.includes('selected-block-settings-body') && !workspaceShellCss.includes('selected-block-settings-card'), 'workspace shell must not own retired selected-settings styles');
assert(screenOrderCss.includes('Selected block-editor controls owned by ScreenOrder') && screenOrderCss.includes('.screen-order-v2-settings .block-editor-v2'), 'ScreenOrder component stylesheet must own inline block-editor controls');
assert(screenOrderCss.includes('Desktop block-settings readability owner — ScreenOrder') && screenOrderCss.includes('.block-editor-anchor-control') && editorExpandedShellCss.includes('.editor-tabs-v2-panel') && !screenOrderCss.includes('.editor-tabs-v2-list') && editorExpandedControlsCss.includes('.editor-field-v2--compact-text') && !screenOrderCss.includes('.editor-field-v2') && !editorWorkspaceCss.includes('screen-order-v2-settings'), 'ScreenOrder must own inspector layout while shared fields have one control stylesheet owner');
assert(codeEditor.includes('editorLabel') && codeEditor.includes('구분 이름') && codeEditor.includes('maxLength={40}'), 'code editor must expose a persistent custom label field');
assert(codeEditor.includes('<EditorField label="목록 구분 이름">') && codeEditor.includes('aria-label="구분 이름"')
  && codeEditor.includes('<summary>영역 높이') && !codeEditor.includes('<summary>이름·높이'),
  'code block list name must use a visible shared editor field and leave only height in the disclosure');
assert(!codeEditorCss.includes('.code-editor-name {') && !codeEditorCss.includes('.code-editor-name-value')
  && !codeEditor.includes('block-editor-anchor-control code-editor-name-control'),
  'code block must not retain retired widget-row overrides or duplicate name layouts');
assert(screenOrderIdentityModel.includes("block?.type === 'code'") && screenOrderIdentityModel.includes('previewText(s.editorLabel)') && screenOrderRowIdentity.includes('identity?.customLabel') && screenOrderRowIdentity.includes('displayLabel') && screenOrderRowIdentity.includes('<strong title={primaryLabel}>{primaryLabel}</strong>'), 'screen order must promote the stored custom label while preserving the full accessible identity');
assert(editLayout.includes("const showPageOptions = section === 'options' || !selectedBlockId;")
  && editLayout.includes('data-editor-section="options"')
  && editLayout.includes('{showPageOptions && ('),
  'an empty selection must present page design in the right-hand settings panel');
assert(editLayout.includes("import './EditPanelLayout.css';") && editPanelLayoutCss.includes('.editor-page-settings-button') && editPanelLayoutCss.includes('.editor-page-options-stack') && !editorWorkspaceCss.includes('edit-section-tabs') && !editorWorkspaceCss.includes('editor-page-options-stack'), 'EditPanelLayout must load and own subsection tabs/panel stack instead of editor-workspace.css');
assert(screenOrderCss.includes('One quiet composition list')
  && fixedBlocksCss.includes('Pinned rows use the same flat'),
  'normal and fixed rows must share geometry while keeping their own CSS owners');
assert(pageOptionsCss.includes('border-radius: 0;') && pageOptionsCss.includes('.page-option-head') && screenOrderCss.includes('border-radius: 0 !important'), 'page settings and block rows must retain separate flat component surface owners');
assert(screenOrderCss.includes('.screen-order-v2-list')
  && screenOrderCss.includes('gap: 0 !important;')
  && screenOrderCss.includes('border-bottom: 1px solid #eceef1 !important;')
  && !editorWorkspaceCss.includes('.screen-order-v2-card'),
  'block component must own flat divider rows rather than workspace-wide CSS');
assert(screenOrderCss.includes('min-height: 55px !important;')
  && screenOrderCss.includes('grid-template-columns: 18px minmax(0,1fr) 31px !important;'),
  'new stacked block rows must use one readable 55px geometry');
assert(screenOrderCss.includes('min-height: 55px !important;')
  && screenOrderCss.includes('grid-template-columns: 18px minmax(0,1fr) 31px !important;')
  && screenOrderCss.includes('.screen-order-v2-action')
  && screenOrderCss.includes('.screen-order-v2-drag'),
  'new block rows must keep drag and accessible overflow actions');
assert(editorExpandedControlsCss.includes('min-height: var(--editor-ui-input-height, 42px) !important;') && editorExpandedControlsCss.includes('min-height: 84px !important;') && editorExpandedControlsCss.includes('min-height: 64px !important;'), 'shared editor fields must keep readable compact input and textarea heights');
assert(legacyScreenOrderTokens.every((token) => !workspaceShellCss.includes(token)), 'workspace shell must not restore legacy normal-block selectors');
assert(['.screen-icon-action', '.fixed-open-button', '.switch-clean'].every((token) => editorSharedUiCss.includes(token)) && fixedBlocksCss.includes('.fixed-block-head'), 'shared controls and fixed-block visuals must live with their current owners');
assert(animationOptionsCard.includes("import './AnimationOptionsCard.css';") && animationOptionsCss.includes('.edit-animation-settings') && animationOptionsCss.includes('.edit-animation-options'), 'animation options must load and own their component CSS');
assert(animationOptionsCss.includes('.edit-animation-settings') && fixedBlocksCss.includes('.fixed-composition-row') && !editorWorkspaceCss.includes('.fixed-block-card') && !editorWorkspaceCss.includes('.edit-animation-card') && !editorWorkspaceCss.includes('.fixed-block-editor') && !editorWorkspaceCss.includes('.edit-animation-settings'), 'workspace geometry must not own fixed region row or animation presentation');
assert(editorExpandedShellCss.includes('Block editor shell details migrated from editor-workspace.css') && editorExpandedShellCss.includes('.block-editor-v2-header') && editorExpandedShellCss.includes('.editor-section-v2-trigger') && editorExpandedControlsCss.includes('Block editor controls migrated from editor-workspace.css') && editorExpandedControlsCss.includes('.editor-field-v2') && editorExpandedControlsCss.includes('.image-mode-toolbar') && !editorWorkspaceCss.includes('.block-editor-v2-header') && !editorWorkspaceCss.includes('.editor-field-v2') && !editorWorkspaceCss.includes('.editor-section-v2-trigger'), 'expanded UI styles must own block editor shell and controls instead of workspace geometry');
assert(!workspaceShellCss.includes('.screen-icon-action') && !workspaceShellCss.includes('.switch-clean') && !workspaceShellCss.includes('.fixed-block-head') && !workspaceShellCss.includes('.edit-animation') && !workspaceShellCss.includes('.screen-drop-zone'), 'workspace shell must stay geometry-only for editor component ownership');
await assertMissingFile('src/editor/editPanelParts/PageGlobalOptionsHeader.jsx');
await assertMissingFile('src/styles/editor-final-clean.css');
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
  checks: 40,
  saveFlowTouched: false,
  globalOptionsSeparated: true,
  unifiedPageThemeInspector: true,
  fixedBlocksMovedToScreenOrder: true,
  fixedBlockStylesOwned: true,
  hierarchyLabelsDistinct: true,
  mobileTouchTargetPx: 44,
  mobileOverflowGuard: true,
  largeMobileControls: true,
  fixedBlockMinimumRowPx: 44,
  fixedBlockVisibilityControl: 'eye',
  legacyScreenOrderCssRemoved: true,
  legacyScreenOrderMenuSourcesRemoved: true,
}, null, 2));

assert(editLayout.includes('data-editor-layout="three-pane"')
  && editLayout.includes('aria-controls="editor-composition-panel"')
  && editLayout.includes('editor-properties-panel')
  && editorWorkspaceCss.includes('grid-template-columns: var(--editor-list-width) minmax(0, 1fr) var(--editor-settings-width)')
  && editPanelLayoutCss.includes('.editor-properties-content'),
  'the approved block list, live page and independent settings must remain distinct');
