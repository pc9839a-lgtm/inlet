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
const pageOptionsCss = await readFile('src/editor/editPanelParts/PageGlobalOptions.css', 'utf8');
const fixedBlocksCss = await readFile('src/editor/editPanelParts/FixedBlocksSection.css', 'utf8');
const workspaceCss = await readFile('src/styles/workspace-shell.css', 'utf8');
const addDockCss = await readFile('src/styles/editor-widget-add-dock.css', 'utf8');

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

assert(css.includes('grid-template-columns: minmax(660px, 720px) minmax(480px, 1fr);'), 'desktop editor must retain the two-column left-editor/right-preview base');
assert(!css.includes('grid-template-columns: 280px minmax(520px, 1fr) 360px !important'), 'three-column production repair must stay removed');
assert(!css.includes('editor-inspector-pane'), 'editor workspace CSS must not restore the right inspector column');
assert(!css.includes('screen-order-v2-inline-editor'), 'workspace geometry must not own inline block editor presentation');
assert(css.includes('editor-page-options-stack'), 'page options and theme controls need a left-panel stack');
assert(fixedBlocksCss.includes('.screen-order-fixed-blocks :is(.fixed-block-card, .edit-animation-card)') && fixedBlocksCss.includes('border-radius: 10px !important') && fixedBlocksCss.includes('min-height: 52px !important') && !css.includes('.screen-order-fixed-blocks'), 'fixed-area cards must stay compact under FixedBlocksSection.css ownership');
assert(workspaceCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr)) !important') && workspaceCss.includes('min-height: 46px !important') && workspaceCss.includes('height: 36px !important'), 'workspace top navigation must stay compact and use exactly four columns');
assert(workspaceCss.includes('background: #f1f3f6 !important') && workspaceCss.includes('color: var(--product-text) !important'), 'active workspace tab must use the compact light selected state instead of a solid dark block');
assert(css.includes('/* >=1181px active editor geometry.') && css.includes('grid-template-columns: clamp(580px, 44vw, 680px) minmax(500px, 1fr) !important;') && css.includes('padding: 12px 10px 96px !important;'), 'active desktop editor geometry must be owned by editor-workspace.css');
assert(addDockCss.includes('/* Active editor dock geometry.') && addDockCss.includes('position: sticky !important;') && addDockCss.includes('max-height: min(62dvh, 620px) !important;') && !css.includes('.fixed-add-dock'), 'active editor add dock must be owned by editor-widget-add-dock.css');
assert(css.includes('@media (min-width: 900px) and (max-width: 1180px)') && css.includes('.builder-shell.edit-mode-shell:not(.mobile-operations-shell) .work-panel') && css.includes('max-width: none !important;') && css.includes('margin-inline: 0 !important;') && css.includes('padding-inline: 10px !important;') && !css.includes('max-width: 760px !important;'), '900-1180px desktop editor geometry must be owned by editor-workspace.css without the old 760px content cap');
assert(
  css.includes("html body #root .builder-shell.edit-mode-shell .edit-layout > .edit-section-tabs[data-pagero-ui='edit-section-tabs-v2']")
    && css.includes("html body #root .builder-shell.edit-mode-shell .edit-layout > .edit-section-tabs[data-pagero-ui='edit-section-tabs-v2'] > .edit-section-tab")
    && css.includes(">.edit-section-tab[data-selected='true']") === false
    && css.includes(".edit-section-tab[data-selected='true']")
    && css.includes('height: 42px !important;')
    && css.includes('height: 36px !important;'),
  'isolated edit section tabs must own the exact compact geometry',
);
assert(css.includes("data-pagero-ui='edit-section-tabs-v2'") && css.includes("data-selected='true'") && css.includes('background: #eef1f5 !important;') && css.includes('background: #fff !important;') && css.includes('border-color: #d9dde4 !important;'), 'isolated edit section tabs must keep the light selected state');
assert(pageOptionsCss.includes('body .builder-shell .page-global-options-card') && pageOptionsCss.includes('padding: 0;') && pageOptionsCss.includes('border-radius: 0;') && pageOptionsCss.includes('background: transparent;') && !css.includes('page-global-options'), 'page options base contract must live in PageGlobalOptions.css and stay out of editor-workspace.css');

console.log(JSON.stringify({
  ok: true,
  checks: 22,
  scope: 'pagero-editor-shell-restored-two-column',
  shell: ['left-editor', 'preview'],
  separateStyleTab: false,
  legacyStyleRouteNormalized: true,
}, null, 2));
