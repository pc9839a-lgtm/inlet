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

assert(!(await exists('src/styles/editor-active-workflow-patch.css')), 'orphaned active workflow CSS must stay deleted');
assert(!(await exists('src/styles/editor-narrow-width-fix.css')), 'orphaned narrow width CSS must stay deleted');
assert(!appStyles.includes('editor-active-workflow-patch.css'), 'app styles must not import the orphaned active workflow CSS');
assert(!appStyles.includes('editor-narrow-width-fix.css'), 'app styles must not import the orphaned narrow width CSS');
assert(workspace.includes('.builder-shell.edit-mode-shell'), 'live edit-mode geometry must remain owned by editor-workspace.css');

console.log(JSON.stringify({
  ok: true,
  checks: 5,
  scope: 'pagero-editor-css-owner-cleanup-3',
  deleted: ['editor-active-workflow-patch.css', 'editor-narrow-width-fix.css'],
  runtimeBehaviorChanged: false,
  next: 'workspace DOM shell restructuring',
}, null, 2));
