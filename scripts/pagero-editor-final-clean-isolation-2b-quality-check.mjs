import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const css = await readFile('src/styles/editor-final-clean.css', 'utf8');
const marker = '/* Pagero editor block-list owner: keep rows simple and details separated. */';
const markerIndex = css.indexOf(marker);
assert(markerIndex >= 0, 'live editor control marker must remain');

const geometry = css.slice(0, markerIndex);
const liveControls = css.slice(markerIndex);

assert(geometry.includes('body:has(.builder-shell),'), 'shared body/root workspace contract must remain active');
assert(geometry.includes('body .builder-shell :is(.panel-header, .top-tabs, .edit-layout, .settings-panel, .style-panel, .inbox-panel, .stats-panel)'), 'shared panel width normalization must remain active');

assert(geometry.includes('body .builder-shell:not(.edit-mode-shell) {'), 'legacy grid geometry must exclude edit mode');
assert(geometry.includes('body .builder-shell:not(.edit-mode-shell) .left-workspace'), 'legacy left geometry must exclude edit mode');
assert(geometry.includes('body .builder-shell:not(.edit-mode-shell) .work-panel'), 'legacy work-panel geometry must exclude edit mode');
assert(geometry.includes('body .builder-shell:not(.edit-mode-shell) .preview-workspace'), 'legacy preview geometry must exclude edit mode');
assert(geometry.includes('body .builder-shell:not(.edit-mode-shell) .preview-sticky'), 'legacy preview sticky geometry must exclude edit mode');
assert(geometry.includes('body .builder-shell:not(.edit-mode-shell) .phone-frame'), 'legacy phone geometry must exclude edit mode');

assert(liveControls.includes('body .builder-shell .edit-layout'), 'live edit-layout control styles must remain active');
assert(liveControls.includes('.selected-block-settings-body'), 'selected block control styling must remain active');
assert(liveControls.includes('.fixed-open-button'), 'fixed block control styling must remain active');

console.log(JSON.stringify({
  ok: true,
  checks: 11,
  scope: 'pagero-editor-final-clean-isolation-2b',
  changed: 'legacy grid/left/preview/phone geometry no longer applies to edit-mode-shell',
  preserved: ['body/root contract', 'shared panel sizing', 'edit controls', 'selected block styles', 'fixed block controls', 'non-edit geometry'],
}, null, 2));
