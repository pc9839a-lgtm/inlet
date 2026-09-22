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
assert(!(await exists('src/styles/editor-p0-workflow.css')), 'dead EditWorkbench workflow CSS file must be deleted');
assert(!(await exists('src/styles/editor-p0-root-fix.css')), 'dead EditWorkbench root CSS file must be deleted');
assert(!workspaceV2.includes("@import './editor-workspace.css'"), 'editor-workspace.css must not be imported twice through editor-workspace-v2.css');
assert(appStyles.includes("editor-workspace-v2.css"), 'compatibility CSS must remain loaded until its live rules are migrated in the next cleanup');
assert(appStyles.includes("editor-final-clean.css"), 'legacy final-clean remains intentionally loaded until the next geometry-owner patch');
assert(appStyles.includes("editor-layout-final.css"), 'legacy layout-final remains intentionally loaded until the next geometry-owner patch');

console.log(JSON.stringify({
  ok: true,
  checks: 8,
  scope: 'pagero-editor-css-owner-cleanup-1',
  removed: ['editor-p0-workflow.css', 'editor-p0-root-fix.css'],
  duplicateImportRemoved: 'editor-workspace.css via editor-workspace-v2.css',
  deferredToNextPatch: ['editor-final-clean.css', 'editor-layout-final.css', 'editor-active-workflow-patch.css', 'editor-narrow-width-fix.css'],
}, null, 2));
