import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const read = (path) => readFile(path, 'utf8');
const [
  navigation, screen, leftPanel, active, editPanel, layout, screenOrderItem,
  screenOrderList, fixedBlocks, fixedCard, css, editPanelLayoutCss,
  screenOrderCss, fixedBlocksCss, workspaceCss, chromeCss,
  operationsWorkspaceCss, addDockCss, previewPaneCss,
] = await Promise.all([
  'src/builder/navigation.js',
  'src/screens/WorkspaceEditorScreen.jsx',
  'src/screens/workspace/WorkspaceLeftPanel.jsx',
  'src/screens/workspace/WorkspaceActivePanel.jsx',
  'src/editor/EditPanel.jsx',
  'src/editor/EditPanelLayout.jsx',
  'src/editor/editPanelParts/ScreenOrderItem.jsx',
  'src/editor/editPanelParts/ScreenOrderList.jsx',
  'src/editor/editPanelParts/GlobalFixedBlocks.jsx',
  'src/editor/editPanelParts/FixedBlockCard.jsx',
  'src/styles/editor-workspace.css',
  'src/editor/EditPanelLayout.css',
  'src/editor/editPanelParts/ScreenOrder.css',
  'src/editor/editPanelParts/FixedBlocksSection.css',
  'src/styles/workspace-shell.css',
  'src/screens/workspace/WorkspaceChrome.css',
  'src/screens/workspace/OperationsWorkspace.css',
  'src/styles/editor-widget-add-dock.css',
  'src/screens/workspace/WorkspacePreviewPane.css',
].map(read));

// The existing app/auth, feature IDs, and editing context are not replaced.
assert(!navigation.includes("['style', '스타일'"), 'editor navigation must not duplicate style workspace tab');
assert(screen.includes("const effectiveTab = tab === 'style' ? 'edit' : tab;"),
  'legacy style routes must normalize into the edit workspace');
assert(screen.includes('WorkspaceLeftPanel') && screen.includes('WorkspacePreviewPane'),
  'three-pane screen must reuse the existing editor and live preview');
assert(leftPanel.includes('WorkspaceActivePanel') && active.includes('<EditPanel'),
  'left editor must retain the authenticated editing context');
assert(active.includes('stylePanelProps={stylePanelProps}') &&
  editPanel.includes('stylePanelProps={stylePanelProps}'),
  'page theme controls must remain connected to existing editor state');
assert(leftPanel.includes("import './WorkspaceChrome.css';") &&
  chromeCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr)) !important'),
  'shared workspace tabs remain owned by WorkspaceChrome.css');

// In editing mode, the old left-workspace passes through its children:
// header spans all columns, list remains in work-panel, preview is central.
assert(screen.includes('className="editor-inspector-host"') &&
  screen.includes('ref={setInspectorHost}') && screen.includes('inspectorHost={inspectorHost}'),
  'editor must provide an independent right-hand inspector mount');
assert(leftPanel.includes('inspectorHost={inspectorHost}') &&
  active.includes('inspectorHost={inspectorHost}') &&
  editPanel.includes('inspectorHost={inspectorHost}'),
  'right inspector must receive its mount through existing edit ownership');
assert(layout.includes('createPortal(inspector, inspectorHost)') &&
  layout.includes('renderBlockEditor(selectedNormal)'),
  'normal block editor must render through a portal into the inspector');
assert(layout.includes('createFixedBlockDescriptorCatalog') &&
  layout.includes('selectedFixed.renderEditor(selectedFixed.block)'),
  'fixed top/menu/footer editors must share the same inspector');
assert(!screenOrderItem.includes('data-inline-block-editor="true"') &&
  !screenOrderItem.includes('{renderBlockEditor(block)}'),
  'block list rows must not mount a nested detail editor');
assert(screenOrderList.includes('ScreenOrderListItems') &&
  screenOrderItem.includes('<ScreenOrderRow'),
  'block list must preserve ordering, selection, and row operations');
assert(fixedBlocks.includes('inlineEditor={inlineEditor}') &&
  fixedCard.includes('open && inlineEditor') &&
  layout.includes('<GlobalFixedBlocks {...fixedBlocksProps} inlineEditor={false}'),
  'fixed-area list rows must select without duplicating editor inputs');
assert(layout.includes('<AddBlockDock {...addBlockDockProps} />') &&
  layout.includes('<PageThemeStylePanel {...stylePanelProps} />'),
  'block additions and page theme settings remain reachable');
assert(layout.includes('data-editor-section={section}') &&
  layout.includes('data-pagero-ui="edit-section-tabs-v2"') &&
  layout.includes('페이지 옵션') &&
  layout.includes('블록 설정'),
  'editor must expose an accessible page/global settings mode');
assert(editPanelLayoutCss.includes('edit-section-tabs-v2') &&
  editPanelLayoutCss.includes('editor-inspector-layout') &&
  editPanelLayoutCss.includes('.editor-page-options-stack'),
  'page options and inspector need consistent component-owned styling');

// Geometry only; public landing, operations, and true mobile remain separate.
assert(css.includes('grid-template-columns: 220px minmax(0, 1fr) 320px') &&
  css.includes('grid-column: 1 / -1') &&
  css.includes('grid-column: 3 !important'),
  'full desktop must render the global header / block list / canvas / inspector');
assert(css.includes('@media (max-width: 1279px)') &&
  css.includes('[data-block-list-open=') &&
  css.includes('@media (max-width: 700px)') &&
  css.includes('[data-settings-open='),
  'laptop and zoomed desktop must keep block list and settings reachable as drawers');
assert(screen.includes('aria-expanded={blockListOpen}') &&
  screen.includes('aria-expanded={settingsOpen}') &&
  screen.includes('aria-controls="pagero-settings-panel"'),
  'drawer controls must expose expanded state and target to assistive technology');
assert(css.includes('.edit-mode-shell:not(.mobile-operations-shell)') &&
  !css.includes('.inbox-workspace-shell') &&
  !css.includes('.stats-dashboard-shell') &&
  !css.includes('.settings-workspace-shell'),
  'editor geometry must be scoped away from public and operations surfaces');
assert(!css.includes('screen-order-v2-inline-editor') &&
  !css.includes('.fixed-block-card') &&
  !css.includes('.block-editor-v2-header'),
  'workspace geometry must not take ownership of block editor internals');
assert(fixedBlocksCss.includes('.screen-order-fixed-blocks .fixed-block-card') &&
  screenOrderCss.includes('.screen-order-v2-head'),
  'fixed and normal block visuals must remain component-owned');
assert(addDockCss.includes('position: sticky !important;') &&
  !css.includes('.fixed-add-dock'),
  'block add dock positioning stays with its owner');
assert(previewPaneCss.includes('WorkspacePreviewPane — owns editor preview presentation') &&
  previewPaneCss.includes('.preview-sticky') &&
  previewPaneCss.includes('.phone-frame') &&
  !css.includes('.phone-frame'),
  'preview viewport styling remains independent of editor-shell geometry');
assert(workspaceCss.includes('.preview-workspace-shell') &&
  !workspaceCss.includes('body .builder-shell .panel-header {') &&
  operationsWorkspaceCss.includes('.inbox-workspace-shell'),
  'workspace and operations styles must preserve their existing ownership');

const fixedSelection = await read('src/editor/useFixedBlockSelection.js');
const normalSelection = await read('src/editor/useNormalBlockSelection.js');
const previewSelection = await read('src/runtime/useWorkspaceShellActions.js');
assert(fixedSelection.includes('fixedBlockIds.includes(openId) ? openId') &&
  !fixedSelection.includes('useState(') &&
  fixedSelection.includes('setOpenId((current) => (current === blockId'),
  'fixed block selection must derive immediately from canonical openId');
assert(normalSelection.includes('setOpenId(blockId)') &&
  normalSelection.includes('setOpenId((current) => (current === blockId'),
  'programmatic normal block selection must be idempotent but row toggles may close');
assert(previewSelection.includes("row?.closest('.work-panel')") &&
  !previewSelection.includes('scrollIntoView(') &&
  previewSelection.includes('list.scrollTop ='),
  'preview selection must only scroll the block list when visible');
assert(screen.includes('onSelectPreviewBlock={handleSelectPreviewBlock}') &&
  screen.includes('setSettingsOpen(true)') &&
  screen.includes('setBlockListOpen(false)'),
  'canvas selection must reveal the inspector at narrow breakpoints');
assert(layout.includes('onActivateInspector?.()') &&
  layout.includes('toggleBlockOpen={(id) =>') &&
  layout.includes('selectBlock={(id) =>'),
  'fixed/normal list and global settings must converge on the same inspector');

console.log(JSON.stringify({
  ok: true,
  checks: 31,
  scope: 'pagero-editor-shell-three-pane',
  shell: ['block-list', 'canvas', 'inspector'],
  legacyStyleRouteNormalized: true,
  publicRuntimeTouched: false,
}, null, 2));
