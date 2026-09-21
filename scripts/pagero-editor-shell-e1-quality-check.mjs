import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const navigation = await readFile('src/builder/navigation.js', 'utf8');
const screen = await readFile('src/screens/WorkspaceEditorScreen.jsx', 'utf8');
const active = await readFile('src/screens/workspace/WorkspaceActivePanel.jsx', 'utf8');
const editPanel = await readFile('src/editor/EditPanel.jsx', 'utf8');
const layout = await readFile('src/editor/EditPanelLayout.jsx', 'utf8');
const css = await readFile('src/styles/editor-workspace.css', 'utf8');
const preview = await readFile('src/screens/workspace/WorkspacePreviewPane.jsx', 'utf8');

assert(!navigation.includes("['style', '스타일'"), 'editor navigation must not expose a separate style workspace tab');
assert(screen.includes("const effectiveTab = tab === 'style' ? 'edit' : tab;"), 'legacy style routes must normalize into edit');
assert(active.includes('stylePanelProps={stylePanelProps}'), 'edit workspace must receive theme controls for the unified inspector');
assert(editPanel.includes('stylePanelProps={stylePanelProps}'), 'EditPanel must forward theme controls to the unified inspector');

assert(layout.includes('editor-structure-pane'), 'editor shell must expose a dedicated structure pane');
assert(layout.includes('editor-inspector-pane'), 'editor shell must expose a dedicated contextual inspector');
assert(layout.includes('editor-left-modes') && layout.includes('구조') && layout.includes('추가'), 'left pane must have structure and add modes');
assert(layout.includes('editor-inspector-modes') && layout.includes('선택 요소') && layout.includes('페이지 · 테마'), 'inspector must switch between selected block and page/theme');
assert(layout.includes('<SelectedBlockSettings') && layout.includes('<PageGlobalOptions') && layout.includes('<PageThemeStylePanel'), 'inspector must own block, page and lazy-loaded theme editing');
assert(layout.includes('setInspectorMode(\'selection\')'), 'block selection must move inspector to the selected element');
assert(layout.includes('addBlockDockProps?.setAddOpen?.(true)'), 'add mode must open the existing add-section source instead of creating a parallel source');

assert(css.includes('grid-template-columns: 280px minmax(520px, 1fr) 360px !important'), 'desktop editor must use the repaired compact structure/canvas/inspector columns');
assert(css.includes('grid-column: 1;') && css.includes('grid-column: 2;') && css.includes('grid-column: 3;'), 'all three editor columns must be owned by the edit shell CSS');
assert(css.includes('html body #root .builder-shell.edit-mode-shell') && css.includes('> .left-workspace') && css.includes('display: contents !important'), 'edit mode must explicitly outrank legacy geometry and flatten the nested left workspace');
assert(css.includes('.editor-add-mode .fixed-add-dock') && css.includes('position: static !important'), 'add-section UI must live inside the left pane, not a floating footer dock');
assert(preview.includes('<span>페이지 캔버스</span>'), 'center surface must be presented as the page canvas');

console.log(JSON.stringify({
  ok: true,
  checks: 16,
  scope: 'pagero-editor-shell-e1',
  shell: ['structure', 'canvas', 'inspector'],
  separateStyleTab: false,
  legacyStyleRouteNormalized: true,
}, null, 2));
