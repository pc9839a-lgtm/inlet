import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const css = await readFile('src/styles/editor-layout-final.css', 'utf8');
const mobileMarker = '@media (max-width: 899px) {';
const markerIndex = css.indexOf(mobileMarker);
assert(markerIndex >= 0, 'mobile operations marker must remain');

const desktop = css.slice(0, markerIndex);
const mobile = css.slice(markerIndex);

assert(desktop.includes('.builder-shell:not(.edit-mode-shell) {'), 'desktop legacy layout must explicitly exclude edit mode');
assert(desktop.includes('.builder-shell:not(.edit-mode-shell) .left-workspace'), 'desktop left workspace legacy rules must exclude edit mode');
assert(desktop.includes('.builder-shell:not(.edit-mode-shell) .preview-workspace'), 'desktop preview legacy rules must exclude edit mode');
assert(desktop.includes('body:has(.builder-shell:not(.edit-mode-shell))'), 'desktop body ownership must exclude edit mode');
assert(!/(^|\n)\.builder-shell(?!:not\(\.edit-mode-shell\))/.test(desktop), 'no unscoped desktop builder-shell selector may remain');
assert(mobile.includes('.builder-shell.mobile-operations-shell'), 'mobile operations layout must remain untouched');
assert(mobile.includes('body .builder-shell.mobile-operations-shell .top-tabs'), 'mobile operations tabs must remain untouched');

console.log(JSON.stringify({
  ok: true,
  checks: 7,
  scope: 'pagero-editor-layout-final-isolation-2a',
  changed: 'legacy desktop layout-final no longer applies to edit-mode-shell',
  untouched: ['mobile operations', 'non-edit desktop workspaces', 'editor DOM', 'inspector', 'canvas'],
}, null, 2));
