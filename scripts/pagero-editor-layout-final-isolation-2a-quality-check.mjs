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

const workspaceShell = await readFile('src/styles/workspace-shell.css', 'utf8');
const previewPane = await readFile('src/screens/workspace/WorkspacePreviewPane.css', 'utf8');

assert(!(await exists('src/styles/editor-layout-final.css')), 'legacy editor-layout-final.css must stay retired');
assert(!(await exists('src/styles/editor-final-clean.css')), 'editor-final-clean.css must stay retired after shell ownership migration');
assert(workspaceShell.includes('Preview-bearing non-edit fallback geometry migrated from editor-final-clean.css') && workspaceShell.includes('body .builder-shell.preview-workspace-shell:not(.edit-mode-shell) {'), 'non-edit desktop geometry must live in workspace-shell.css');
assert(workspaceShell.includes('body .builder-shell.preview-workspace-shell:not(.edit-mode-shell) .left-workspace') && workspaceShell.includes('border-right: 1px solid #d9dee8 !important;'), 'non-edit left workspace geometry must preserve its divider contract under workspace-shell.css');
assert(previewPane.includes('Non-edit preview geometry formerly carried by editor-final-clean.css') && previewPane.includes('body .builder-shell.preview-workspace-shell:not(.edit-mode-shell) .preview-sticky') && previewPane.includes('position: sticky !important;') && previewPane.includes('top: 28px !important;') && !workspaceShell.includes('.preview-sticky') && !workspaceShell.includes('.phone-frame'), 'non-edit preview geometry must remain owned by WorkspacePreviewPane.css');
assert(workspaceShell.includes('body .builder-shell.preview-workspace-shell:not(.edit-mode-shell) .work-panel > *') && workspaceShell.includes('box-sizing: border-box !important;'), 'non-edit work-panel children must preserve width and box-sizing normalization under workspace-shell.css');
assert(workspaceShell.includes('Mobile operations presentation migrated from editor-layout-final.css') && workspaceShell.includes('.builder-shell.mobile-operations-shell') && workspaceShell.includes('.mobile-operations-header'), 'mobile operations presentation must live in workspace-shell.css');
assert(workspaceShell.includes('body .builder-shell.mobile-operations-shell .top-tabs') && workspaceShell.includes('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'), 'mobile operations tabs must preserve the two-column layout');

console.log(JSON.stringify({
  ok: true,
  checks: 7,
  scope: 'pagero-editor-layout-final-isolation-2a',
  changed: 'editor-layout-final retired into current geometry and workspace shell owners',
  owners: ['workspace-shell.css', 'WorkspacePreviewPane.css'],
  untouched: ['editor DOM', 'inspector', 'canvas'],
}, null, 2));
