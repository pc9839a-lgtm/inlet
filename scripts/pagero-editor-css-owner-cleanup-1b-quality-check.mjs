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
const workspaceShell = await readFile('src/styles/workspace-shell.css', 'utf8');
const editorWorkspace = await readFile('src/styles/editor-workspace.css', 'utf8');
const workspacePreview = await readFile('src/screens/workspace/WorkspacePreviewPane.css', 'utf8');

assert(!appStyles.includes("editor-p0-workflow.css"), 'dead EditWorkbench workflow CSS must not be loaded');
assert(!appStyles.includes("editor-p0-root-fix.css"), 'dead EditWorkbench root CSS must not be loaded');
assert(!(await exists('src/styles/editor-p0-workflow.css')), 'dead EditWorkbench workflow CSS file must stay deleted');
assert(!(await exists('src/styles/editor-p0-root-fix.css')), 'dead EditWorkbench root CSS file must stay deleted');
assert(!(await exists('src/styles/editor-workspace-v2.css')) && !appStyles.includes('editor-workspace-v2.css') && workspaceShell.includes('Stable authenticated workspace viewport contract') && workspacePreview.includes('Editor preview viewport parity with the public landing width') && !editorWorkspace.includes('Editor preview viewport parity with the public landing width'), 'workspace-v2 compatibility CSS must stay retired with its shell and preview contracts moved to current owners');

console.log(JSON.stringify({
  ok: true,
  checks: 5,
  scope: 'pagero-editor-css-owner-cleanup-1b',
  runtimeScope: 'dead CSS, compatibility CSS and duplicate import only',
}, null, 2));
