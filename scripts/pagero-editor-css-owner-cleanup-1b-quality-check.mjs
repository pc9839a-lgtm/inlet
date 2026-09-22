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
const workspaceV2 = await readFile('src/styles/editor-workspace-v2.css', 'utf8');

assert(!appStyles.includes("editor-p0-workflow.css"), 'dead EditWorkbench workflow CSS must not be loaded');
assert(!appStyles.includes("editor-p0-root-fix.css"), 'dead EditWorkbench root CSS must not be loaded');
assert(!(await exists('src/styles/editor-p0-workflow.css')), 'dead EditWorkbench workflow CSS file must stay deleted');
assert(!(await exists('src/styles/editor-p0-root-fix.css')), 'dead EditWorkbench root CSS file must stay deleted');
assert(!workspaceV2.includes("@import './editor-workspace.css'"), 'editor-workspace.css must not be imported twice through editor-workspace-v2.css');

console.log(JSON.stringify({
  ok: true,
  checks: 5,
  scope: 'pagero-editor-css-owner-cleanup-1b',
  runtimeScope: 'dead CSS and duplicate import only',
}, null, 2));
