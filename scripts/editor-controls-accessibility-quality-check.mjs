import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const paths = {
  tabs: 'src/editor/ui/EditorTabs.jsx',
  menu: 'src/editor/editPanelParts/ScreenOrderRowActions.jsx',
  row: 'src/editor/editPanelParts/ScreenOrderRow.jsx',
  field: 'src/editor/FieldControl.jsx',
  shell: 'src/runtime/useWorkspaceShellActions.js',
  fixed: 'src/editor/useFixedBlockSelection.js',
  normal: 'src/editor/useNormalBlockSelection.js',
  selection: 'src/editor/useEditPanelSelection.jsx',
  layout: 'src/editor/EditPanelLayout.jsx',
  card: 'src/editor/editPanelParts/FixedBlockCard.jsx',
};
const sources = Object.fromEntries(await Promise.all(
  Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')]),
));
const contains = (key, text) => assert.ok(sources[key].includes(text), `${paths[key]}: missing ${text}`);

// A focused source contract supplements the runtime hook tests without opening a browser.
for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) contains('tabs', `'${key}'`);
for (const text of ['aria-selected={selected}', 'tabIndex={selected ? 0 : -1}',
  'onKeyDown={(event) => onTabKeyDown(event, index)}', 'tabRefs.current.get(next.id)?.focus',
  'tabIndex={0}', 'previousActiveId']) contains('tabs', text);
for (const text of ["document.addEventListener('pointerdown'", "document.addEventListener('focusin'",
  "document.addEventListener('keydown'", 'document.addEventListener(MENU_OPEN_EVENT',
  'previousSelectedRef.current !== selected', 'triggerRef.current.focus',
  'aria-expanded={menuOpen}', 'aria-haspopup="true"', 'onKeyDown={toggleMenuByKey}', 'nextRow?.isConnected']) contains('menu', text);
contains('row', 'selected={open}');
assert.equal(sources.field.match(/value=\{value \?\? ''\}/g)?.length, 2);
assert.ok(!sources.field.includes("value={value || ''}"));
contains('selection', 'fixedBlockIds: [topNavBlock?.id, bottomBlock?.id, footerBlock?.id]');
contains('layout', "if (selectedBlockId) setSection('order')");
contains('card', 'id={`editor-block-${block.id}`}');

function loadHook(key, symbol, context) {
  const source = sources[key]
    .replace(/^import [^\n]*;\r?\n/gm, '')
    .replace(/export function /g, 'function ');
  return vm.runInNewContext(`${source}\n${symbol}`, context, { filename: paths[key] });
}

const scrollTargets = [];
const changedTabs = [];
const changedIds = [];
const blocks = [
  { id: 'ordinary-1', type: 'text' },
  { id: 'topnav-1', type: 'topnav' },
  { id: 'footer-1', type: 'footer' },
];
const selectPreview = loadHook('shell', 'useWorkspaceShellActions', {
  DASHBOARD_KEY: 'dashboard', START_MODE_KEY: 'start', confirmWorkspaceLeaveSync: () => true,
  requestAnimationFrame: (callback) => callback(),
  document: { getElementById(id) {
    if (id.startsWith('editor-block-settings-') && id !== 'editor-block-settings-ordinary-1') return null;
    return { scrollIntoView() { scrollTargets.push(id); } };
  } },
})({
  page: { blocks }, canUseBuilder: true, canManageAdmin: true, allowedTabs: ['edit'],
  confirmLeaveStyleChanges: () => true, clearPendingStyle: () => {},
  saveLocalJson: () => {}, setStartMode: () => {}, setAddOpen: () => {},
  setWorkspaceOpen: () => {}, setTab: (value) => changedTabs.push(value),
  setOpenId: (value) => changedIds.push(value),
}).selectPreviewBlock;
selectPreview('ordinary-1');
selectPreview('topnav-1');
selectPreview('footer-1');
selectPreview('missing');
assert.deepEqual(changedIds, ['ordinary-1', 'topnav-1', 'footer-1']);
assert.deepEqual(changedTabs, ['edit', 'edit', 'edit']);
assert.deepEqual(scrollTargets, ['editor-block-settings-ordinary-1', 'editor-block-topnav-1', 'editor-block-footer-1']);

let openId = 'topnav-1';
const setOpenId = (next) => { openId = typeof next === 'function' ? next(openId) : next; };
let hookState = [];
let stateIndex = 0;
let effects = [];
const fakeReact = {
  useState(initial) {
    const index = stateIndex++;
    if (!(index in hookState)) hookState[index] = initial;
    return [hookState[index], (next) => {
      hookState[index] = typeof next === 'function' ? next(hookState[index]) : next;
    }];
  },
  useEffect(effect) { effects.push(effect); },
  useCallback(callback) { return callback; },
};
const fixedHook = loadHook('fixed', 'useFixedBlockSelection', { React: fakeReact });
function renderFixed() {
  stateIndex = 0;
  effects = [];
  const result = fixedHook({
    setAddOpen: () => {}, setOpenId, openId, fixedBlockIds: ['topnav-1', 'footer-1'],
  });
  effects.forEach((run) => run());
  return result;
}
renderFixed();
assert.equal(renderFixed().fixedOpenId, 'topnav-1', 'preview selection should open fixed settings');
renderFixed().toggleBlockOpen('topnav-1');
assert.equal(openId, '', 'fixed disclosure should close the shared selection');
renderFixed();
assert.equal(renderFixed().fixedOpenId, '');
renderFixed().toggleBlockOpen('footer-1');
assert.equal(openId, 'footer-1', 'fixed disclosure should select its block');
renderFixed();
assert.equal(renderFixed().fixedOpenId, 'footer-1');

const normalHook = loadHook('normal', 'useNormalBlockSelection', {
  React: { useCallback: (callback) => callback },
  isSelectedOpenIdNormalBlock: (items, id) => items.some((item) => item.id === id),
});
const normalArgs = { normalBlocks: [blocks[0]], get openId() { return openId; },
  setOpenId, setAddOpen: () => {} };
assert.equal(normalHook(normalArgs).normalSelectedId, '', 'fixed block must not select a normal row');
normalHook(normalArgs).selectBlock('ordinary-1');
assert.equal(normalHook(normalArgs).normalSelectedId, 'ordinary-1');
normalHook(normalArgs).selectBlock('ordinary-1');
assert.equal(openId, '', 'normal row selection should toggle closed');
setOpenId('footer-1');
assert.equal(normalHook(normalArgs).normalSelectedId, '', 'switching to fixed should clear normal selection');

console.log('editor controls accessibility: source contracts and selection hook regressions passed');
