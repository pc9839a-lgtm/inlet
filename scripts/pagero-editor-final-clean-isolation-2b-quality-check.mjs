import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const css = await readFile('src/styles/editor-final-clean.css', 'utf8');
const sharedUiCss = await readFile('src/styles/editor-shared-ui.css', 'utf8');
const fixedBlocksCss = await readFile('src/editor/editPanelParts/FixedBlocksSection.css', 'utf8');
const animationCss = await readFile('src/editor/editPanelParts/AnimationOptionsCard.css', 'utf8');
const screenOrderCss = await readFile('src/editor/editPanelParts/ScreenOrder.css', 'utf8');
const previewPaneCss = await readFile('src/screens/workspace/WorkspacePreviewPane.css', 'utf8');

assert(css.includes('/* Pagero editor stable workspace owner */'), 'final-clean must retain the workspace geometry contract');
assert(css.includes('body:has(.builder-shell),'), 'shared body/root workspace contract must remain active');
assert(css.includes('body .builder-shell :is(.panel-header, .top-tabs, .edit-layout, .settings-panel, .style-panel, .inbox-panel, .stats-panel)'), 'shared panel width normalization must remain active');

assert(css.includes('body .builder-shell:not(.edit-mode-shell) {'), 'legacy grid geometry must exclude edit mode');
assert(css.includes('body .builder-shell:not(.edit-mode-shell) .left-workspace'), 'legacy left geometry must exclude edit mode');
assert(css.includes('body .builder-shell:not(.edit-mode-shell) .work-panel'), 'legacy work-panel geometry must exclude edit mode');
assert(previewPaneCss.includes('body .builder-shell:not(.edit-mode-shell) .preview-workspace') && previewPaneCss.includes('body .builder-shell:not(.edit-mode-shell) .preview-sticky') && previewPaneCss.includes('body .builder-shell:not(.edit-mode-shell) .phone-frame'), 'non-edit preview geometry must stay scoped outside edit mode under WorkspacePreviewPane.css');
assert(!css.includes('.preview-workspace') && !css.includes('.preview-sticky') && !css.includes('.phone-frame'), 'final-clean must no longer own preview presentation');

assert(!css.includes('.switch-clean') && !css.includes('.fixed-open-button') && !css.includes('.fixed-block-head') && !css.includes('.edit-animation') && !css.includes('.screen-drop-zone'), 'final-clean must stay workspace-geometry-only');
assert(sharedUiCss.includes('Shared editor controls migrated from editor-final-clean') && sharedUiCss.includes('.switch-clean') && sharedUiCss.includes('.fixed-open-button'), 'shared editor controls must be owned by editor-shared-ui.css');
assert(fixedBlocksCss.includes('Fixed-block visual controls migrated from the global final-clean layer') && fixedBlocksCss.includes('.fixed-block-head'), 'fixed block visuals must be owned by FixedBlocksSection.css');
assert(animationCss.includes('Animation options — component-owned editor surface') && animationCss.includes('.edit-animation-card') && animationCss.includes('.edit-animation-options'), 'animation options must own their component stylesheet');
assert(screenOrderCss.includes('Inline block-editor controls owned by ScreenOrder v1') && screenOrderCss.includes('.screen-order-v2-inline-editor .block-editor-v2'), 'inline selected block control styling must be owned by ScreenOrder.css');

console.log(JSON.stringify({
  ok: true,
  checks: 14,
  scope: 'pagero-editor-final-clean-isolation-2b',
  changed: 'editor-final-clean is shell geometry only; preview geometry is component-owned',
  preserved: ['body/root contract', 'shared panel sizing', 'non-edit shell geometry', 'preview via WorkspacePreviewPane.css', 'shared controls via editor-shared-ui.css', 'fixed blocks via FixedBlocksSection.css', 'animation via AnimationOptionsCard.css', 'inline block styles via ScreenOrder.css'],
}, null, 2));
