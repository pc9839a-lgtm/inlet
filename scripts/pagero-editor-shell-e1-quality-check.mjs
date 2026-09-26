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

assert(!navigation.includes("['style', '스타일'"), 'editor navigation must not expose a duplicate style workspace tab');
assert(screen.includes("const effectiveTab = tab === 'style' ? 'edit' : tab;"), 'legacy style routes must still normalize into edit');
assert(active.includes('stylePanelProps={stylePanelProps}'), 'edit workspace must receive theme controls');
assert(editPanel.includes('stylePanelProps={stylePanelProps}'), 'EditPanel must forward theme controls');

assert(layout.includes('edit-section-tabs') && layout.includes('페이지 옵션') && layout.includes('화면 순서'), 'left editor must expose page options and screen order modes');
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
assert(css.includes('body .builder-shell .edit-section-tabs') && css.includes('background: #eef1f5;') && css.includes('min-height: 36px;') && css.includes('border-color: #d9dde4;') && css.includes('background: #fff;'), 'edit section tabs must stay compact and use a light segmented selected state');

console.log(JSON.stringify({
  ok: true,
  checks: 18,
  scope: 'pagero-editor-shell-restored-two-column',
  shell: ['left-editor', 'preview'],
  separateStyleTab: false,
  legacyStyleRouteNormalized: true,
}, null, 2));
