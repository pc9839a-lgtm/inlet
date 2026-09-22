import { access, readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const appStyles = await readFile('src/app-styles.css', 'utf8');
const workspace = await readFile('src/styles/editor-workspace.css', 'utf8');
const workspaceScreen = await readFile('src/screens/WorkspaceEditorScreen.jsx', 'utf8');

assert(!(await exists('src/styles/editor-active-workflow-patch.css')), 'orphaned active workflow CSS must stay deleted');
assert(!(await exists('src/styles/editor-narrow-width-fix.css')), 'orphaned narrow width CSS must stay deleted');
assert(!appStyles.includes('editor-active-workflow-patch.css'), 'app styles must not import the orphaned active workflow CSS');
assert(!appStyles.includes('editor-narrow-width-fix.css'), 'app styles must not import the legacy narrow width CSS');
assert(!workspaceScreen.includes('editor-active-workflow-patch.css'), 'WorkspaceEditorScreen must not import the legacy active workflow CSS');
assert(!workspaceScreen.includes('editor-narrow-width-fix.css'), 'WorkspaceEditorScreen must not import the legacy narrow width CSS');
assert(workspace.includes('.builder-shell.edit-mode-shell'), 'live edit-mode geometry must remain owned by editor-workspace.css');

console.log(JSON.stringify({
  ok: true,
  checks: 7,
  scope: 'pagero-editor-css-owner-cleanup-3',
  deleted: ['editor-active-workflow-patch.css', 'editor-narrow-width-fix.css'],
  runtimeBehaviorChanged: 'legacy geometry detached from active screen',
  next: 'workspace DOM shell restructuring',
}, null, 2));
