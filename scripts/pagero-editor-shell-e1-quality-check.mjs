import { access, readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function missing(path) {
  try {
    await access(path);
    return false;
  } catch {
    return true;
  }
}

const navigation = await readFile('src/builder/navigation.js', 'utf8');
const screen = await readFile('src/screens/WorkspaceEditorScreen.jsx', 'utf8');
const shell = await readFile('src/screens/workspace/WorkspaceEditShell.jsx', 'utf8');
const editPanel = await readFile('src/editor/EditPanel.jsx', 'utf8');
const layout = await readFile('src/editor/EditPanelLayout.jsx', 'utf8');
const css = await readFile('src/styles/editor-workspace.css', 'utf8');
const appStyles = await readFile('src/app-styles.css', 'utf8');
const finalClean = await readFile('src/styles/editor-final-clean.css', 'utf8');
const preview = await readFile('src/screens/workspace/WorkspacePreviewPane.jsx', 'utf8');

assert(!navigation.includes("['style', '스타일'"), 'editor navigation must not expose a separate style workspace tab');
assert(screen.includes("const effectiveTab = tab === 'style' ? 'edit' : tab;"), 'legacy style routes must normalize into edit');
assert(screen.includes('<WorkspaceEditShell') && screen.includes('if (editWorkspace && !templateIntroWorkspace)'), 'edit mode must use the dedicated editor shell instead of WorkspaceLeftPanel');
assert(!screen.includes("import '../styles/editor-narrow-width-fix.css'") && !screen.includes("import '../styles/editor-active-workflow-patch.css'"), 'WorkspaceEditorScreen must not load legacy edit geometry patches');

assert(shell.includes('<PanelHeader') && shell.includes('<WorkspaceTabs') && shell.includes('<EditPanel'), 'dedicated editor shell must own header, global nav and editor body');
assert(shell.includes('previewPane={previewPane}'), 'dedicated editor shell must send the preview into the editor body');
assert(editPanel.includes('previewPane={previewPane}') && editPanel.includes("onClearSelection={() => setOpenId('')}"), 'EditPanel must wire the center canvas and page-mode selection clear');

assert(layout.includes('editor-structure-pane'), 'editor shell must expose a dedicated structure pane');
assert(layout.includes('editor-canvas-pane') && layout.includes('{previewPane}'), 'editor shell must expose the real center canvas as a sibling');
assert(layout.includes('editor-inspector-pane'), 'editor shell must expose a dedicated contextual inspector');
assert(layout.indexOf('editor-structure-pane') < layout.indexOf('editor-canvas-pane') && layout.indexOf('editor-canvas-pane') < layout.indexOf('editor-inspector-pane'), 'editor DOM order must be structure -> canvas -> inspector');
assert(layout.includes('editor-left-modes') && layout.includes('구성') && layout.includes('추가'), 'left pane must expose only composition and add modes');
assert(!layout.includes('페이지 구성</strong>') && !layout.includes('섹션 추가</strong>'), 'editor must not duplicate descriptive pane headings');
assert(layout.includes("selectedBlockSettingsProps ? ' has-selection' : ' page-only'"), 'inspector must not render a permanently disabled selection tab');
assert(layout.includes('onClearSelection?.();') && layout.includes('페이지'), 'page inspector mode must clear the active block selection');
assert(layout.includes('<SelectedBlockSettings') && layout.includes('<PageGlobalOptions') && layout.includes('<PageThemeStylePanel'), 'inspector must keep block, page and lazy-loaded theme editing');

assert(css.includes('grid-template-rows: var(--product-topbar-h) 48px minmax(0, 1fr)'), 'editor shell must own header/nav/body rows');
assert(css.includes('grid-template-columns: 280px minmax(0, 1fr) 360px'), 'editor body must own structure/canvas/inspector columns');
assert(css.includes('> .edit-layout.editor-shell-v2') && !css.includes('display: contents !important'), 'editor geometry must be applied to the real editor body without display:contents flattening');
assert(css.includes('.editor-canvas-pane > .preview-workspace'), 'preview geometry must be scoped to the real canvas pane');
assert(!css.includes('minmax(660px, 720px) minmax(480px, 1fr)'), 'old two-column editor geometry must be gone');

for (const obsolete of [
  'editor-layout-final.css',
  'editor-workspace-v2.css',
  'editor-p0-workflow.css',
  'editor-p0-root-fix.css',
]) {
  assert(!appStyles.includes(obsolete), `app-styles must not import obsolete geometry owner: ${obsolete}`);
}
assert(!finalClean.includes('--pg-left-width') && !finalClean.includes('grid-template-columns: var(--pg-left-width)'), 'editor-final-clean must remain control polish only');
assert(await missing('src/styles/editor-layout-final.css'), 'obsolete editor-layout-final.css must be deleted');
assert(await missing('src/styles/editor-workspace-v2.css'), 'obsolete editor-workspace-v2.css must be deleted');
assert(await missing('src/styles/editor-p0-workflow.css'), 'dead EditWorkbench P0 workflow CSS must be deleted');
assert(await missing('src/styles/editor-p0-root-fix.css'), 'dead EditWorkbench P0 root CSS must be deleted');
assert(await missing('src/styles/editor-narrow-width-fix.css'), 'legacy narrow width geometry patch must be deleted');
assert(await missing('src/styles/editor-active-workflow-patch.css'), 'legacy active workflow geometry patch must be deleted');

assert(!preview.includes('<span>페이지 캔버스</span>') && !preview.includes('<strong>/{page.slug}</strong>'), 'preview chrome must not duplicate canvas label, slug and full URL');
assert(preview.includes('<a className="preview-link"'), 'preview chrome must keep one navigable page address');

console.log(JSON.stringify({
  ok: true,
  checks: 32,
  scope: 'pagero-editor-shell-owner-cleanup',
  dom: ['header', 'global-nav', 'structure', 'canvas', 'inspector'],
  geometryOwners: ['workspace-shell.css', 'editor-workspace.css'],
  removedGeometryFiles: 6,
  displayContents: false,
  separateStyleTab: false,
}, null, 2));
