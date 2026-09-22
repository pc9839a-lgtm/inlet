import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const layout = await readFile('src/editor/EditPanelLayout.jsx', 'utf8');
const theme = await readFile('src/editor/editPanelParts/PageThemeInspector.jsx', 'utf8');
const pageOptions = await readFile('src/editor/editPanelParts/PageGlobalOptions.jsx', 'utf8');
const css = await readFile('src/styles/editor-workspace.css', 'utf8');
const browser = await readFile('scripts/editor-browser-regression-check.mjs', 'utf8');

assert(layout.includes("import { PageThemeInspector }"), 'compact theme inspector must be imported directly');
assert(!layout.includes('PageThemeStylePanel') && !layout.includes("import('../panels/StylePanel.jsx')"), 'full StylePanel must not be embedded in the editor inspector');
assert(layout.includes('<PageGlobalOptions {...pageGlobalOptionsProps} showTitle={false} />'), 'page options must suppress the duplicate internal heading');
assert(layout.includes('<PageThemeInspector page={stylePanelProps.page} updateTheme={stylePanelProps.updateTheme} />'), 'page theme section must use the compact inspector');
assert(layout.includes("selectedBlockSettingsProps && (") && layout.includes('>선택<') === false, 'selection/page switch must only exist when a block is selected');
assert(!layout.includes('disabled={!selectedBlockSettingsProps}'), 'inspector must not render a disabled selection tab');

assert(pageOptions.includes('showTitle = true') && pageOptions.includes('{showTitle && <PageGlobalOptionsHeader />}'), 'page options must support heading suppression without removing the reusable heading');
assert(theme.includes("['background', '배경']") && theme.includes("['color', '색상']") && theme.includes("['text', '글자']"), 'compact theme inspector must retain background/color/text groups');
assert(theme.includes("bgMode") && theme.includes("gradientFrom") && theme.includes("bgImage"), 'compact theme inspector must retain solid/gradient/image background editing');
assert(theme.includes("accent") && theme.includes("globalAlign") && theme.includes("fontFamily"), 'compact theme inspector must retain accent and typography controls');
assert(!theme.includes('style-apply-btn') && !theme.includes('style-reset-btn'), 'compact theme inspector must not restore staged apply/reset controls');

assert(css.includes('.page-theme-inspector') && css.includes('.page-theme-nav') && css.includes('.inspector-segment'), 'compact inspector styling must remain in the main editor CSS owner');
assert(css.includes('.editor-page-inspector .page-global-options-card') && css.includes('border: 0 !important'), 'page options wrapper must not become a nested card inside the inspector');
assert(!css.includes('.editor-inspector-pane .style-apply-bar'), 'legacy StylePanel apply-bar inspector override must stay removed');
assert(css.includes('.editor-inspector-modes button.active') && css.includes('background: #eef4ff'), 'inspector tab selection must remain lightweight instead of the old black filled state');

assert(browser.includes("clickButtonByText(client, '.editor-inspector-modes', '페이지')"), 'real browser QA must enter compact page settings');
assert(browser.includes(".page-theme-inspector") && browser.includes('theme accent local update'), 'real browser QA must exercise immediate compact theme editing');
assert(browser.includes('undo compact theme edit') && browser.includes('redo compact theme edit'), 'real browser QA must verify compact theme edit undo/redo');
assert(browser.includes("style-apply-btn, .style-reset-btn"), 'real browser QA must verify staged style controls are absent');
assert(browser.includes("theme-immediate"), 'browser result must report the new immediate theme flow');

console.log(JSON.stringify({
  ok: true,
  checks: 20,
  scope: 'pagero-editor-inspector-compact-5',
  removedFromInspector: ['full StylePanel', 'staged apply/reset', 'disabled selection tab', 'duplicate global heading'],
  retainedThemeFeatures: ['solid', 'gradient', 'image', 'effect', 'accent', 'text color', 'align', 'font'],
  themeMutation: 'immediate local draft with undo/redo',
  cssOwner: 'editor-workspace.css',
}, null, 2));
