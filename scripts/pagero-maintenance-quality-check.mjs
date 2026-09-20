import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(full));
    else out.push(full.replaceAll('\\', '/'));
  }
  return out;
}

const forbidden = [
  '.backups/pre-inbox-redesign-20260805-1001.txt',
  'src/editor/EditWorkbench.jsx',
  'src/styles/edit-workbench-hotfix.css',
  'src/styles/edit-workbench-v3.css',
  'docs/editor-block-editor-ux-ui-spec.md',
  'docs/editor-block-editor-modernization-v2.md',
  'docs/PAGERO_CALLTAG_UI_UX_UNIFICATION_PLAN_KO.md',
  'docs/CALLTAG_GOOGLE_PLAY_PREREGISTRATION_GATE_KO.md',
  'docs/CALLTAG_ENTITLEMENT_LIFECYCLE_WEB_PRECHECK_KO.md',
  'docs/CALLTAG_PAGERO_UNIFIED_BILLING_REFERRAL_ARCHITECTURE_KO.md',
  'docs/AUTH_EMAIL_VERIFICATION_STORAGE_COMPAT_HOTFIX_KO.md',
  'docs/ops-auth-email-hotfix-deploy-20260807.md',
  'docs/deploy-github-cloudflare.md',
  'docs/CUSTOM_DOMAIN_SETTINGS_KO.md',
  'docs/SEO_SETTINGS_UI_RULES_KO.md',
];

for (const file of forbidden) {
  assert(!(await exists(file)), `stale PageRo maintenance file reintroduced: ${file}`);
}

const required = [
  'docs/README.md',
  'docs/PAGERO_MAINTENANCE_HANDOFF_KO.md',
  'docs/PAGERO_INTERNAL_OPTIMIZATION_MASTER_KO.md',
  'docs/PAGERO_EDITOR_PRODUCT_DIRECTION_KO.md',
  'docs/PAGERO_PLAN_POLICY_KO.md',
];

for (const file of required) {
  assert(await exists(file), `required PageRo source-of-truth missing: ${file}`);
}

const docs = (await listFiles('docs')).filter((file) => file.endsWith('.md'));
assert(docs.length <= 35, `PageRo docs inventory grew beyond maintenance budget: ${docs.length}`);

const workspaceSource = await readFile('src/screens/WorkspaceEditorScreen.jsx', 'utf8');
assert(workspaceSource.includes("WorkspaceLeftPanel"), 'current editor shell must use WorkspaceLeftPanel');
assert(!workspaceSource.includes('EditWorkbench'), 'dead EditWorkbench path must not return to WorkspaceEditorScreen');
assert(!workspaceSource.includes('edit-workbench-v3.css'), 'dead workbench CSS must not return');
assert(!workspaceSource.includes('edit-workbench-hotfix.css'), 'dead workbench hotfix CSS must not return');


const editorWorkspaceCss = await readFile('src/styles/editor-workspace.css', 'utf8');
for (const legacySelector of ['.screen-order-item', '.screen-order-head', '.screen-title-wrap', '.screen-drag-handle', '.screen-row-action-menu']) {
  assert(!editorWorkspaceCss.includes(legacySelector), `legacy screen-order selector reintroduced in editor-workspace.css: ${legacySelector}`);
}
assert(await exists('src/editor/editPanelParts/ScreenOrder.css'), 'ScreenOrder.css must remain the current screen-order CSS owner');

const docsIndex = await readFile('docs/README.md', 'utf8');
assert(docsIndex.includes('PAGERO_EDITOR_PRODUCT_DIRECTION_KO.md'), 'docs index must point to current editor product direction');
assert(docsIndex.includes('PAGERO_INTERNAL_OPTIMIZATION_MASTER_KO.md'), 'docs index must point to current execution master');

console.log(JSON.stringify({
  ok: true,
  scope: 'pagero-maintenance-contract',
  docsCount: docs.length,
  forbiddenFiles: forbidden.length,
  requiredSources: required.length,
  currentEditorPathProtected: true,
}, null, 2));
