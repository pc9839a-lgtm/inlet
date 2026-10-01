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
const addDockCss = await readFile('src/styles/editor-widget-add-dock.css', 'utf8');
const previewPaneCss = await readFile('src/screens/workspace/WorkspacePreviewPane.css', 'utf8');

assert(!navigation.includes("['style', '스타일'"), 'editor navigation must not expose a duplicate style workspace tab');
assert(screen.includes("const effectiveTab = tab === 'style' ? 'edit' : tab;"), 'legacy style routes must still normalize into edit');
assert(active.includes('stylePanelProps={stylePanelProps}'), 'edit workspace must receive theme controls');
assert(editPanel.includes('stylePanelProps={stylePanelProps}'), 'EditPanel must forward theme controls');

assert(layout.includes('data-pagero-ui="edit-section-tabs-v2"') && layout.includes('className="edit-section-tab"') && layout.includes('페이지 옵션') && layout.includes('화면 순서'), 'left editor must expose isolated page options and screen order tabs');
assert(!layout.includes("className={section === 'options' ? 'active' : ''}") && !layout.includes("className={section === 'order' ? 'active' : ''}"), 'edit section tabs must not reuse the global active class');
assert(screenOrderItem.includes('screen-order-v2-inline-editor') && screenOrderItem.includes('data-inline-block-editor="true"') && screenOrderItem.includes('{renderBlockEditor(block)}'), 'selected block editor must render directly below the row without a redundant settings shell');
assert(layout.includes('<ScreenOrderList {...screenOrderListProps} />') && !layout.includes('selectedBlockSettingsProps'), 'screen order must remain in the left editor without redundant selected-settings props');
assert(layout.includes('<AddBlockDock {...addBlockDockProps} />'), 'section add dock must remain in the left editor');
assert(layout.includes('<PageThemeStylePanel {...stylePanelProps} />'), 'page theme controls must remain available from page options');
assert(!layout.includes('editor-structure-pane') && !layout.includes('editor-inspector-pane'), 'three-pane editor DOM must not return');

assert(css.includes('PageRo editor workspace — outer edit-shell geometry only') && css.includes('@media (min-width: 900px)') && !css.includes('@media (max-width: 1280px)'), 'editor workspace CSS must keep one explicit 900px+ geometry contract without the dead max-1280 layer');
assert(!css.includes('grid-template-columns: 280px minmax(520px, 1fr) 360px !important'), 'three-column production repair must stay removed');
assert(!css.includes('editor-inspector-pane'), 'editor workspace CSS must not restore the right inspector column');
assert(!css.includes('screen-order-v2-inline-editor'), 'workspace geometry must not own inline block editor presentation');
assert(!css.includes('.fixed-block-card') && !css.includes('.edit-animation-card') && !css.includes('.fixed-block-editor') && !css.includes('.edit-animation-settings'), 'workspace geometry must not own fixed or animation cards');
assert(!css.includes('.block-editor-v2-header') && !css.includes('.editor-field-v2') && !css.includes('.editor-section-v2-trigger') && !css.includes('.editor-segmented-v2') && !css.includes('.image-mode-toolbar'), 'workspace geometry must not own block editor internals');
assert(editPanelLayoutCss.includes('editor-page-options-stack'), 'page options and theme controls need a left-panel stack owned by EditPanelLayout.css');
assert(fixedBlocksCss.includes('.screen-order-fixed-blocks :is(.fixed-block-card, .edit-animation-card)') && fixedBlocksCss.includes('border-radius: 10px !important') && fixedBlocksCss.includes('min-height: 52px !important') && !css.includes('.screen-order-fixed-blocks'), 'fixed-area cards must stay compact under FixedBlocksSection.css ownership');
assert(leftPanel.includes("import './WorkspaceChrome.css';") && chromeCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr)) !important') && chromeCss.includes('min-height: 46px !important') && chromeCss.includes('height: 36px !important'), 'WorkspaceChrome.css must own compact four-column workspace navigation');
assert(chromeCss.includes('background: #f1f3f6 !important') && chromeCss.includes('color: var(--product-text) !important'), 'active workspace tab must use the compact light selected state from WorkspaceChrome.css');
assert(css.includes('/* Desktop: two-column editor / preview shell. */') && css.includes('grid-template-columns: clamp(580px, 44vw, 680px) minmax(500px, 1fr) !important;') && css.includes('padding: 12px 10px 96px !important;'), 'active desktop editor geometry must be owned by editor-workspace.css');
assert(addDockCss.includes('/* Active editor dock geometry.') && addDockCss.includes('position: sticky !important;') && addDockCss.includes('max-height: min(62dvh, 620px) !important;') && !css.includes('.fixed-add-dock'), 'active editor add dock must be owned by editor-widget-add-dock.css');
assert(css.includes('/* Tablet / narrow desktop: stack editor and preview vertically. */') && css.includes('@media (min-width: 900px) and (max-width: 1180px)') && css.includes('.builder-shell.edit-mode-shell:not(.mobile-operations-shell) .work-panel') && css.includes('max-width: none !important;') && css.includes('margin-inline: 0 !important;') && css.includes('padding-inline: 10px !important;') && !css.includes('max-width: 760px !important;'), '900-1180px editor geometry must stay as the explicit stacked-shell contract without the old 760px content cap');
assert(
  editPanelLayoutCss.includes("html body #root .builder-shell.edit-mode-shell .edit-layout > .edit-section-tabs[data-pagero-ui='edit-section-tabs-v2']")
    && editPanelLayoutCss.includes("html body #root .builder-shell.edit-mode-shell .edit-layout > .edit-section-tabs[data-pagero-ui='edit-section-tabs-v2'] > .edit-section-tab")
    && editPanelLayoutCss.includes(">.edit-section-tab[data-selected='true']") === false
    && editPanelLayoutCss.includes(".edit-section-tab[data-selected='true']")
    && editPanelLayoutCss.includes('height: 42px !important;')
    && editPanelLayoutCss.includes('height: 36px !important;'),
  'EditPanelLayout.css must own the exact compact subsection tab geometry',
);
assert(editPanelLayoutCss.includes("data-pagero-ui='edit-section-tabs-v2'") && editPanelLayoutCss.includes("data-selected='true'") && editPanelLayoutCss.includes('background: #eef1f5 !important;') && editPanelLayoutCss.includes('background: #fff !important;') && editPanelLayoutCss.includes('border-color: #d9dde4 !important;'), 'EditPanelLayout.css must keep the light selected state');
assert(!css.includes('edit-section-tabs') && !css.includes('editor-page-options-stack'), 'workspace geometry must not own EditPanelLayout subsection UI');
assert(previewPaneCss.includes('WorkspacePreviewPane — owns editor preview presentation') && previewPaneCss.includes('.preview-workspace') && previewPaneCss.includes('.preview-sticky') && previewPaneCss.includes('.phone-frame') && previewPaneCss.includes('scroll-margin-block: 120px') && !css.includes('.preview-workspace') && !css.includes('.preview-sticky') && !css.includes('.phone-frame'), 'WorkspacePreviewPane.css must own preview presentation while editor-workspace.css stays geometry-only');
assert(pageOptionsCss.includes('body .builder-shell .page-global-options-card') && pageOptionsCss.includes('padding: 0;') && pageOptionsCss.includes('border-radius: 0;') && pageOptionsCss.includes('background: transparent;') && !css.includes('page-global-options'), 'page options base contract must live in PageGlobalOptions.css and stay out of editor-workspace.css');
assert(!workspaceCss.includes('body .builder-shell .panel-header {') && !workspaceCss.includes('body .builder-shell .top-tabs {'), 'workspace shell must not own PanelHeader or top-tabs presentation');

console.log(JSON.stringify({
  ok: true,
  checks: 22,
  scope: 'pagero-editor-shell-restored-two-column',
  shell: ['left-editor', 'preview'],
  separateStyleTab: false,
  legacyStyleRouteNormalized: true,
}, null, 2));
