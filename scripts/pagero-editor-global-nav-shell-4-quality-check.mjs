import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const screen = await readFile('src/screens/WorkspaceEditorScreen.jsx', 'utf8');
const left = await readFile('src/screens/workspace/WorkspaceLeftPanel.jsx', 'utf8');
const css = await readFile('src/styles/editor-workspace.css', 'utf8');
const browser = await readFile('scripts/editor-browser-regression-check.mjs', 'utf8');

assert(screen.includes("import { WorkspaceTabs } from './workspace/WorkspaceTabs.jsx';"), 'WorkspaceEditorScreen must own the edit workspace tabs');
assert(screen.includes('hideTabs={editWorkspace}'), 'edit workspace must suppress the nested left-panel tabs');
assert(screen.includes("editWorkspace && (") && screen.includes('<WorkspaceTabs allowedTabs={allowedTabs} tab={effectiveTab} changeTab={changeTab} />'), 'edit workspace must render tabs at the shell root');
assert(left.includes('hideTabs = false') && left.includes('!hideTabs && <WorkspaceTabs'), 'WorkspaceLeftPanel must keep tabs for non-edit workspaces while omitting them for edit');

assert(css.includes('> .top-tabs {') && css.includes('grid-column: 1 / -1;') && css.includes('grid-row: 2;'), 'edit tabs must own a full-width second shell row');
assert(css.includes('display: flex !important;') && css.includes('justify-content: flex-start !important;'), 'global edit tabs must use a horizontal workspace navigation row');
assert(!css.includes('> .left-workspace > .top-tabs'), 'edit tabs must not have nested left-workspace geometry');
assert(css.includes('> .preview-workspace {\n  grid-column: 2;\n  grid-row: 3;'), 'preview must start below the global navigation row');
assert(css.includes('.editor-inspector-pane {\n  grid-column: 3;\n  grid-row: 3;'), 'inspector must start below the global navigation row');

assert(browser.includes('tabsRootLevel'), 'real browser QA must verify root-level workspace navigation');
assert(browser.includes('workspace tabs must span the shell'), 'real browser QA must verify full-width workspace navigation');
assert(browser.includes('structure pane must start below the global workspace tabs'), 'real browser QA must prevent the structure pane from overlapping navigation');
assert(browser.includes('preview pane must start below the global workspace tabs'), 'real browser QA must prevent canvas/navigation overlap');
assert(browser.includes('inspector pane must start below the global workspace tabs'), 'real browser QA must prevent inspector/navigation overlap');

console.log(JSON.stringify({
  ok: true,
  checks: 14,
  scope: 'pagero-editor-global-nav-shell-4',
  changed: 'edit workspace navigation DOM ownership only',
  untouched: ['inspector design', 'canvas zoom', 'add panel redesign', 'selection scroll sync', 'operations workspace tabs'],
}, null, 2));
