import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const layoutFinal = await readFile('src/styles/editor-layout-final.css', 'utf8');
const finalClean = await readFile('src/styles/editor-final-clean.css', 'utf8');

for (const token of [
  '--editor-left-width',
  '--editor-panel-width',
  '--editor-preview-width',
  'grid-template-columns: var(--editor-left-width)',
  '.builder-shell .preview-workspace .preview-sticky',
]) {
  assert(!layoutFinal.includes(token), `layout-final must not own desktop editor geometry: ${token}`);
}

for (const token of [
  '--pg-left-width',
  '--pg-panel-width',
  '--pg-preview-width',
  'grid-template-columns: var(--pg-left-width)',
  'body .builder-shell .preview-workspace',
  'body .builder-shell .preview-sticky',
]) {
  assert(!finalClean.includes(token), `final-clean must not own workspace geometry: ${token}`);
}

assert(layoutFinal.includes('.builder-shell.mobile-operations-shell'), 'layout-final must retain mobile operations rules for now');
assert(layoutFinal.includes('@media (max-width: 899px)'), 'mobile operations breakpoint must remain');
assert(finalClean.includes('Pagero editor block-list owner'), 'final-clean must retain live editor control/card styling');
assert(finalClean.includes('.selected-block-settings-body'), 'final-clean must retain selected block editor styling');

console.log(JSON.stringify({
  ok: true,
  checks: 15,
  scope: 'pagero-editor-css-owner-cleanup-2',
  removedOwners: ['editor-layout-final desktop geometry', 'editor-final-clean workspace geometry'],
  retained: ['mobile operations rules', 'editor control/card styling'],
  deferred: ['editor-active-workflow-patch.css', 'editor-narrow-width-fix.css', 'workspace DOM shell'],
}, null, 2));
