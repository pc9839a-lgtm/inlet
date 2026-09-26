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
const workspaceCss = await readFile('src/styles/workspace-shell.css', 'utf8');
const activeWorkflowCss = await readFile('src/styles/editor-active-workflow-patch.css', 'utf8');
const narrowEditorCss = await readFile('src/styles/editor-narrow-width-fix.css', 'utf8');

assert(!navigation.includes("['style', '스타일'"), 'editor navigation must not expose a duplicate style workspace tab');
assert(screen.includes("const effectiveTab = tab === 'style' ? 'edit' : tab;"), 'legacy style routes must still normalize into edit');
assert(active.includes('stylePanelProps={stylePanelProps}'), 'edit workspace must receive theme controls');
assert(editPanel.includes('stylePanelProps={stylePanelProps}'), 'EditPanel must forward theme controls');

assert(layout.includes('data-pagero-ui="edit-section-tabs-v2"') && layout.includes('className="edit-section-tab"') && layout.includes('페이지 옵션') && layout.includes('화면 순서'), 'left editor must expose isolated page options and screen order tabs');
assert(!layout.includes("className={section === 'options' ? 'active' : ''}") && !layout.includes("className={section === 'order' ? 'active' : ''}"), 'edit section tabs must not reuse the global active class');
assert(screenOrderItem.includes('screen-order-v2-settings-panel') && screenOrderItem.includes('<SelectedBlockSettings {...selectedBlockSettingsProps} />'), 'selected block settings must remain inside the left editor flow directly below the selected row');
assert(layout.includes('<ScreenOrderList') && layout.includes('selectedBlockSettingsProps={selectedBlockSettingsProps}'), 'screen order must remain in the left editor and receive selected settings');
assert(layout.includes('<AddBlockDock {...addBlockDockProps} />'), 'section add dock must remain in the left editor');
assert(layout.includes('<PageThemeStylePanel {...stylePanelProps} />'), 'page theme controls must remain available from page options');
assert(!layout.includes('editor-structure-pane') && !layout.includes('editor-inspector-pane'), 'three-pane editor DOM must not return');

assert(css.includes('grid-template-columns: minmax(660px, 720px) minmax(480px, 1fr);'), 'desktop editor must retain the two-column left-editor/right-preview base');
assert(!css.includes('grid-template-columns: 280px minmax(520px, 1fr) 360px !important'), 'three-column production repair must stay removed');
assert(!css.includes('editor-inspector-pane'), 'editor workspace CSS must not restore the right inspector column');
assert(css.includes('editor-page-options-stack'), 'page options and theme controls need a left-panel stack');
assert(css.includes('.screen-order-fixed-blocks :is(.fixed-block-card, .edit-animation-card)') && css.includes('border-radius: 10px !important') && css.includes('min-height: 52px !important'), 'restored left editor fixed-area cards must stay compact');
assert(workspaceCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr)) !important') && workspaceCss.includes('min-height: 46px !important') && workspaceCss.includes('height: 36px !important'), 'workspace top navigation must stay compact and use exactly four columns');
assert(workspaceCss.includes('background: #f1f3f6 !important') && workspaceCss.includes('color: var(--product-text) !important'), 'active workspace tab must use the compact light selected state instead of a solid dark block');
assert(activeWorkflowCss.includes('grid-template-columns: clamp(580px, 44vw, 680px) minmax(500px, 1fr) !important;') && activeWorkflowCss.includes('padding: 12px 10px 96px !important;'), 'active desktop editor must keep the wider editing pane and tighter horizontal padding');
assert(narrowEditorCss.includes('.builder-shell.edit-mode-shell:not(.mobile-operations-shell) .work-panel') && narrowEditorCss.includes('max-width: none !important;') && narrowEditorCss.includes('margin-inline: 0 !important;') && narrowEditorCss.includes('padding-inline: 10px !important;') && !narrowEditorCss.includes('max-width: 760px !important;'), '900-1180px desktop editor must not restore the old 760px content cap');
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
assert(css.includes('body .builder-shell .edit-layout .page-global-options-card') && css.includes('padding: 0;') && css.includes('border-radius: 0;') && css.includes('background: transparent;') && !css.includes('.page-global-options-card {\n  width: 100%;\n  min-width: 0;\n  max-width: 100%;\n  margin: 0;\n  padding: 14px;'), 'page options outer shell must stay flat without the restored white card chrome');

console.log(JSON.stringify({
  ok: true,
  checks: 22,
  scope: 'pagero-editor-shell-restored-two-column',
  shell: ['left-editor', 'preview'],
  separateStyleTab: false,
  legacyStyleRouteNormalized: true,
}, null, 2));
