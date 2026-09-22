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

assert(geometry.includes('body .builder-shell:not(.edit-mode-shell) {'), 'legacy final-clean geometry must exclude edit mode');
assert(geometry.includes('body .builder-shell:not(.edit-mode-shell) .left-workspace'), 'legacy left-workspace geometry must exclude edit mode');
assert(geometry.includes('body .builder-shell:not(.edit-mode-shell) .preview-workspace'), 'legacy preview geometry must exclude edit mode');
assert(geometry.includes('body:has(.builder-shell:not(.edit-mode-shell))'), 'body-level legacy geometry ownership must exclude edit mode');
assert(!/body \.builder-shell(?!:not\(\.edit-mode-shell\))/.test(geometry), 'no unscoped legacy geometry selector may remain before live control styles');

assert(liveControls.includes('body .builder-shell .edit-layout'), 'live edit-layout control styles must remain active');
assert(liveControls.includes('.selected-block-settings-body'), 'selected block control styling must remain active');
assert(liveControls.includes('.fixed-open-button'), 'fixed block control styling must remain active');

console.log(JSON.stringify({
  ok: true,
  checks: 8,
  scope: 'pagero-editor-final-clean-isolation-2b',
  changed: 'legacy final-clean geometry no longer applies to edit-mode-shell',
  preserved: ['edit control styles', 'selected block styles', 'fixed block controls', 'non-edit workspace geometry'],
}, null, 2));
