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

const finalClean = await readFile('src/styles/editor-final-clean.css', 'utf8');
const workspaceShell = await readFile('src/styles/workspace-shell.css', 'utf8');
const previewPane = await readFile('src/screens/workspace/WorkspacePreviewPane.css', 'utf8');

assert(!(await exists('src/styles/editor-layout-final.css')), 'legacy editor-layout-final.css must stay retired');
assert(finalClean.includes('body .builder-shell:not(.edit-mode-shell) {'), 'non-edit desktop geometry must remain in editor-final-clean.css');
assert(finalClean.includes('body .builder-shell:not(.edit-mode-shell) .left-workspace') && finalClean.includes('border-right: 1px solid #d9dee8 !important;'), 'non-edit left workspace geometry must preserve its divider contract');
assert(previewPane.includes('Non-edit preview geometry formerly carried by editor-final-clean.css') && previewPane.includes('body .builder-shell:not(.edit-mode-shell) .preview-sticky') && previewPane.includes('position: sticky !important;') && previewPane.includes('top: 28px !important;') && !finalClean.includes('.preview-sticky') && !finalClean.includes('.phone-frame'), 'non-edit preview geometry must be owned by WorkspacePreviewPane.css');
assert(finalClean.includes('body .builder-shell:not(.edit-mode-shell) .work-panel > *') && finalClean.includes('box-sizing: border-box !important;'), 'non-edit work-panel children must preserve width and box-sizing normalization');
assert(workspaceShell.includes('Mobile operations presentation migrated from editor-layout-final.css') && workspaceShell.includes('.builder-shell.mobile-operations-shell') && workspaceShell.includes('.mobile-operations-header'), 'mobile operations presentation must live in workspace-shell.css');
assert(workspaceShell.includes('body .builder-shell.mobile-operations-shell .top-tabs') && workspaceShell.includes('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'), 'mobile operations tabs must preserve the two-column layout');

console.log(JSON.stringify({
  ok: true,
  checks: 7,
  scope: 'pagero-editor-layout-final-isolation-2a',
  changed: 'editor-layout-final retired into current geometry and workspace shell owners',
  owners: ['editor-final-clean.css', 'workspace-shell.css', 'WorkspacePreviewPane.css'],
  untouched: ['editor DOM', 'inspector', 'canvas'],
}, null, 2));
