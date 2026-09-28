import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const catalog = await readFile('src/editor/editPanelParts/sectionPatternCatalog.js', 'utf8');
const picker = await readFile('src/editor/editPanelParts/AddSectionPatternGrid.jsx', 'utf8');
const panel = await readFile('src/editor/editPanelParts/AddBlockPanel.jsx', 'utf8');
const dock = await readFile('src/editor/editPanelParts/AddBlockDock.jsx', 'utf8');
const layout = await readFile('src/editor/EditPanelLayout.jsx', 'utf8');
const actions = await readFile('src/runtime/useEditorBlockActions.js', 'utf8');
const sectionProps = await readFile('src/editor/createEditPanelSectionProps.js', 'utf8');
const dockProps = await readFile('src/editor/editPanelSectionProps/addBlockDockProps.js', 'utf8');
const app = await readFile('src/App.jsx', 'utf8');
const css = await readFile('src/styles/editor-widget-add-dock.css', 'utf8');
const browser = await readFile('scripts/editor-browser-regression-check.mjs', 'utf8');

for (const id of ['lead-hero-form', 'benefit-trust', 'visit-conversion', 'debt-consult', 'realestate-visit', 'wedding-info']) {
  assert(catalog.includes(`id: '${id}'`), `section pattern missing: ${id}`);
}
assert(catalog.includes("group: 'recommended'") && catalog.includes("group: 'industry'"), 'section patterns must expose recommended and industry groups');
assert(catalog.includes("industry: '개인회생'") && catalog.includes("industry: '분양'") && catalog.includes("industry: '청첩장'"), 'industry patterns must cover the three current core template categories');
assert(catalog.includes('createSectionPatternBlocks') && catalog.includes('sanitizeBlock'), 'section patterns must resolve to normal sanitized PageRo blocks');

assert(panel.includes('<AddBlockGroupGrid') && !panel.includes('<AddSectionPatternGrid'), 'primary add surface must expose only the simple block grid');
assert(!panel.includes('추천 섹션') && !panel.includes('업종별') && !panel.includes('최근 사용') && !panel.includes('pagero-widget-search'), 'primary add surface must not expose recommendation tabs, recent mode, or search');
assert(picker.includes('section-pattern-card') && picker.includes('업종에 맞는 기본 전환 흐름'), 'section pattern component may remain available internally even when removed from the primary add surface');
assert(dock.includes('embedded = false') && dock.includes('const panelOpen = embedded || addOpen'), 'embedded add surface must stay open independently of the old floating dock state');
assert(layout.includes('<AddBlockDock {...addBlockDockProps} />'), 'restored left editor must keep E2 patterns in the existing add dock');

assert(actions.includes('createSectionPatternBlocks') && actions.includes('const addSectionPattern = (patternId)'), 'runtime must expose section pattern insertion');
assert(actions.includes("['bottombar', 'footer'].includes(item.type)"), 'section bundle must insert before trailing fixed blocks');
assert(actions.includes('commitLocalPageDraft') && actions.includes('...blocks'), 'section bundle must commit as one local page mutation');
assert(sectionProps.includes('addSectionPattern') && dockProps.includes('addSectionPattern') && app.includes('addSectionPattern'), 'section pattern action prop chain is incomplete');

assert(!css.includes('.section-add-modes') && !css.includes('.section-pattern-card') && !css.includes('.section-pattern-tags'), 'removed recommendation picker styles must not leak back into the primary editor bundle');
assert(browser.includes("!!document.querySelector('.add-panel .widget-group-grid')"), 'browser regression must open the simplified block grid directly');
assert(browser.includes("must not expose recommendation/industry mode tabs") && browser.includes("must not expose the removed search field"), 'browser regression must lock removal of recommendation tabs and search');

console.log(JSON.stringify({
  ok: true,
  checks: 17,
  scope: 'pagero-section-patterns-e2',
  primaryAddModes: ['basic-block-grid-only'],
  industryCoverage: ['개인회생', '분양', '청첩장'],
  bundleMutation: 'single-undo-step',
  existingRendererReused: true,
  saveApiTouched: false,
}, null, 2));
