import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const navigation = await readFile('src/builder/navigation.js', 'utf8');
const screen = await readFile('src/screens/WorkspaceEditorScreen.jsx', 'utf8');
const active = await readFile('src/screens/workspace/WorkspaceActivePanel.jsx', 'utf8');
const editPanel = await readFile('src/editor/EditPanel.jsx', 'utf8');
const layout = await readFile('src/editor/EditPanelLayout.jsx', 'utf8');
const screenOrderItem = await readFile('src/editor/editPanelParts/ScreenOrderItem.jsx', 'utf8');
const css = await readFile('src/styles/editor-workspace.css', 'utf8');
const editPanelLayoutCss = await readFile('src/editor/EditPanelLayout.css', 'utf8');
const pageOptionsCss = await readFile('src/editor/editPanelParts/PageGlobalOptions.css', 'utf8');
const fixedBlocksCss = await readFile('src/editor/editPanelParts/FixedBlocksSection.css', 'utf8');
const workspaceCss = await readFile('src/styles/workspace-shell.css', 'utf8');
const chromeCss = await readFile('src/screens/workspace/WorkspaceChrome.css', 'utf8');
const leftPanel = await readFile('src/screens/workspace/WorkspaceLeftPanel.jsx', 'utf8');
const workspaceScreen = await readFile('src/screens/WorkspaceEditorScreen.jsx', 'utf8');
const operationsWorkspaceCss = await readFile('src/screens/workspace/OperationsWorkspace.css', 'utf8');
const addDockCss = await readFile('src/styles/editor-widget-add-dock.css', 'utf8');
const previewPaneCss = await readFile('src/screens/workspace/WorkspacePreviewPane.css', 'utf8');

assert(!navigation.includes("['style', '스타일'"), 'editor navigation must not expose a duplicate style workspace tab');
assert(screen.includes("const effectiveTab = tab === 'style' ? 'edit' : tab;"), 'legacy style routes must still normalize into edit');
assert(active.includes('stylePanelProps={stylePanelProps}'), 'edit workspace must receive theme controls');
assert(editPanel.includes('stylePanelProps={stylePanelProps}'), 'EditPanel must forward theme controls');

assert(!layout.includes('CompositionDrawer') && layout.includes('editor-composition-panel') && layout.includes('페이지 설정') && layout.includes('inspectorOnly'), 'editor must show composition beside the selected-item inspector');
assert(!layout.includes("className={section === 'options' ? 'active' : ''}") && !layout.includes("className={section === 'order' ? 'active' : ''}"), 'edit section tabs must not reuse the global active class');
assert(!screenOrderItem.includes('renderBlockEditor') && !screenOrderItem.includes('data-inline-block-editor'), 'block list rows must no longer expand the selected settings inline');
assert(layout.includes('listOnly selectBlock={chooseBlock}') && !layout.includes('compositionOpen'), 'composition selection must not hide the persistent list');
assert(layout.includes('<AddBlockDock {...addBlockDockProps} />'), 'section add dock must remain in the left editor');
assert(layout.includes('<PageThemeStylePanel {...stylePanelProps} />'), 'page theme controls must remain available from page options');
assert(!layout.includes('editor-structure-pane') && !layout.includes('className="editor-inspector-pane"'), 'three-pane editor DOM must not return');

assert(css.includes('.canvas-editor-shell') && css.includes('@media (max-width: 899px)'), 'canvas shell must keep desktop and zoom geometry');
assert(!css.includes('grid-template-columns: 280px minmax(520px, 1fr) 360px !important'), 'three-column production repair must stay removed');
assert(!css.includes('editor-inspector-pane'), 'editor workspace CSS must not restore the right inspector column');
assert(!css.includes('screen-order-v2-settings'), 'workspace geometry must not own inline block editor presentation');
assert(!css.includes('.fixed-block-card') && !css.includes('.edit-animation-card') && !css.includes('.fixed-block-editor') && !css.includes('.edit-animation-settings'), 'workspace geometry must not own fixed or animation cards');
assert(!css.includes('.block-editor-v2-header') && !css.includes('.editor-field-v2') && !css.includes('.editor-section-v2-trigger') && !css.includes('.editor-segmented-v2') && !css.includes('.image-mode-toolbar'), 'workspace geometry must not own block editor internals');
assert(editPanelLayoutCss.includes('editor-page-options-stack'), 'page options and theme controls need a left-panel stack owned by EditPanelLayout.css');
assert(fixedBlocksCss.includes('.screen-order-fixed-blocks .fixed-composition-row')
  && fixedBlocksCss.includes('grid-template-columns: 20px minmax(0, 1fr) 30px 30px !important')
  && fixedBlocksCss.includes('.fixed-composition-select')
  && !css.includes('.screen-order-fixed-blocks'),
  'fixed areas must use aligned compact rows under FixedBlocksSection.css ownership');
assert(leftPanel.includes("import './WorkspaceChrome.css';") && chromeCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr)) !important') && chromeCss.includes('min-height: 46px !important') && chromeCss.includes('height: 36px !important'), 'WorkspaceChrome.css must own compact four-column workspace navigation');
assert(chromeCss.includes('background: #f1f3f6 !important') && chromeCss.includes('color: var(--product-text) !important'), 'active workspace tab must use the compact light selected state from WorkspaceChrome.css');
assert(css.includes('grid-template-columns: clamp(500px, calc(100vw - 460px), 1180px) minmax(0, 1fr) !important;') && css.includes('grid-column: 1;'), 'studio must keep the left editor and reserve one 390px phone preview');
assert(layout.includes('editor-composition-heading') && editPanelLayoutCss.includes('grid-template-columns: clamp(176px, 18vw, 256px) minmax(0, 1fr) !important;'), 'block list and selected inspector must be distinct, readable regions');
assert(previewPaneCss.includes('width: 402px !important;') && previewPaneCss.includes('width: 392px !important;') && previewPaneCss.includes('--landing-runtime-width: 390px;'), 'desktop and compact editor must keep exactly one 390px mobile canvas');
assert(addDockCss.includes('/* Active editor dock geometry.')
  && addDockCss.includes('position: static !important;')
  && addDockCss.includes('max-height: none !important;')
  && addDockCss.includes('overflow-y: visible !important;')
  && !css.includes('.fixed-add-dock'), 'editor add catalog must expand inline without nested scrolling');
assert(css.includes('grid-template-columns: minmax(0, 1fr) !important;') && css.includes('overflow: auto !important;'), 'zoomed desktop must preserve reachable page and inspector');
assert(layout.includes('className="editor-page-settings-button"')
  && layout.includes('aria-controls="editor-selection-panel"')
  && !layout.includes('edit-section-tabs') && !editPanelLayoutCss.includes('edit-section-tabs'),
  'page settings must use one composition entry without a second inspector tab bar');
assert(editPanelLayoutCss.includes('.editor-composition-panel > .editor-page-settings-button')
  && editPanelLayoutCss.includes('min-height: 40px !important;'),
  'the page-settings entry must remain visibly reachable in the composition owner');
assert(!css.includes('edit-section-tabs') && !css.includes('editor-page-options-stack'), 'workspace geometry must not own EditPanelLayout subsection UI');
assert(previewPaneCss.includes('WorkspacePreviewPane — owns editor preview presentation') && previewPaneCss.includes('.preview-workspace') && previewPaneCss.includes('.preview-sticky') && previewPaneCss.includes('.phone-frame') && previewPaneCss.includes('scroll-margin-block: 120px') && !css.includes('.preview-workspace') && !css.includes('.preview-sticky') && !css.includes('.phone-frame'), 'WorkspacePreviewPane.css must own preview presentation while editor-workspace.css stays geometry-only');
assert(pageOptionsCss.includes('body .builder-shell .page-global-options-card') && pageOptionsCss.includes('padding: 0;') && pageOptionsCss.includes('border-radius: 0;') && pageOptionsCss.includes('background: transparent;') && !css.includes('page-global-options'), 'page options base contract must live in PageGlobalOptions.css and stay out of editor-workspace.css');
assert(!workspaceCss.includes('body .builder-shell .panel-header {') && !workspaceCss.includes('body .builder-shell .top-tabs {'), 'workspace shell must not own PanelHeader or top-tabs presentation');
assert(workspaceScreen.includes("import './workspace/OperationsWorkspace.css';") && operationsWorkspaceCss.includes('.inbox-workspace-shell') && operationsWorkspaceCss.includes('.stats-dashboard-shell') && operationsWorkspaceCss.includes('.settings-workspace-shell') && !workspaceCss.includes('.inbox-workspace-shell'), 'desktop operations geometry must be isolated from the common workspace shell');

console.log(JSON.stringify({
  ok: true,
  checks: 23,
  scope: 'pagero-editor-canvas-and-inspector',
  shell: ['left-composition-and-settings', 'right-page-preview'],
  separateStyleTab: false,
  legacyStyleRouteNormalized: true,
}, null, 2));
