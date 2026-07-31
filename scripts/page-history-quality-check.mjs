import { readFile } from 'node:fs/promises';
import {
  bindPageHistoryRuntime,
  clearPageHistory,
  getPageHistoryState,
  pageHistoryIdentity,
  PAGE_HISTORY_MAX_STEPS,
  PAGE_HISTORY_TYPING_WINDOW_MS,
  recordPageHistoryMutation,
  redoPageHistory,
  syncPageHistoryPage,
  undoPageHistory,
} from '../src/runtime/pageHistoryStore.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const basePage = {
  id: 'history-page',
  projectId: 'history-project',
  ownerId: 'history-owner',
  slug: 'history-page',
  title: '처음 제목',
  revision: 7,
  updatedAt: '2026-07-31T03:00:00.000Z',
  theme: { accent: '#111827' },
  blocks: [
    { id: 'block-a', type: 'hero', visible: true, s: { title: '처음 문구' } },
    { id: 'block-b', type: 'text', visible: true, s: { title: '안내' } },
  ],
};

assert(PAGE_HISTORY_MAX_STEPS === 50, 'page history must keep exactly 50 recent steps');
assert(PAGE_HISTORY_TYPING_WINDOW_MS === 700, 'typing and slider changes must coalesce within 700ms');
assert(pageHistoryIdentity(basePage) === pageHistoryIdentity({ ...basePage, slug: 'changed', revision: 99, blocks: [...basePage.blocks].reverse() }), 'slug, revision, and block order must not change an existing page history identity');
assert(pageHistoryIdentity(basePage) !== pageHistoryIdentity({ ...basePage, id: 'other-page' }), 'different page IDs must use isolated histories');
assert(pageHistoryIdentity(basePage) !== pageHistoryIdentity({ ...basePage, projectId: 'other-project' }), 'different projects must use isolated histories');

let visiblePage = clone(basePage);
let runtimeClock = 10_000;
const commitThroughRuntime = (nextPage) => {
  recordPageHistoryMutation(visiblePage, nextPage, runtimeClock);
  visiblePage = clone(nextPage);
  return visiblePage;
};
bindPageHistoryRuntime({
  setPage: (updater) => {
    visiblePage = typeof updater === 'function' ? updater(visiblePage) : updater;
  },
  commitLocalPageDraft: commitThroughRuntime,
});

function reset(page = basePage) {
  visiblePage = clone(page);
  clearPageHistory(visiblePage);
  syncPageHistoryPage(visiblePage);
}

function mutate(nextPage, now) {
  recordPageHistoryMutation(visiblePage, nextPage, now);
  visiblePage = clone(nextPage);
  syncPageHistoryPage(visiblePage);
}

reset();
mutate({ ...visiblePage, title: '제목 1' }, 1_000);
mutate({ ...visiblePage, title: '제목 12' }, 1_180);
mutate({ ...visiblePage, title: '제목 123' }, 1_360);
assert(getPageHistoryState().undoCount === 1, `rapid text edits must be one undo step: ${JSON.stringify(getPageHistoryState())}`);
visiblePage = { ...visiblePage, revision: 8, updatedAt: '2026-07-31T03:05:00.000Z' };
syncPageHistoryPage(visiblePage);
runtimeClock = 2_000;
assert(undoPageHistory(), 'typing burst must be undoable');
assert(visiblePage.title === '처음 제목', `undo must restore the pre-typing title: ${visiblePage.title}`);
assert(visiblePage.revision === 8 && visiblePage.updatedAt === '2026-07-31T03:05:00.000Z', 'undo must preserve current server revision metadata');
assert(getPageHistoryState().canRedo, 'undo must create a redo step');
assert(redoPageHistory(), 'typing burst must be redoable');
assert(visiblePage.title === '제목 123', `redo must restore the latest title: ${visiblePage.title}`);
assert(getPageHistoryState().undoCount === 1 && !getPageHistoryState().canRedo, 'redo must return the step to undo history');

reset();
mutate({ ...visiblePage, blocks: [...visiblePage.blocks, { id: 'block-c', type: 'image', visible: true, s: {} }] }, 3_000);
mutate({ ...visiblePage, blocks: [...visiblePage.blocks, { id: 'block-d', type: 'faq', visible: true, s: {} }] }, 3_100);
assert(getPageHistoryState().undoCount === 2, 'separate structural edits must not be coalesced');
assert(undoPageHistory(), 'the second structural edit must be undoable');
assert(visiblePage.blocks.length === 3 && !visiblePage.blocks.some((block) => block.id === 'block-d'), 'structural undo must remove only the latest block');
mutate({ ...visiblePage, title: '분기된 새 변경' }, 4_000);
assert(!getPageHistoryState().canRedo, 'a new edit after undo must clear redo history');

reset();
for (let index = 0; index < 56; index += 1) {
  mutate({ ...visiblePage, title: `단계 ${index}` }, 10_000 + (index * 1_000));
}
assert(getPageHistoryState().undoCount === 50, `history must be capped at 50 steps: ${getPageHistoryState().undoCount}`);

const otherPage = {
  ...basePage,
  id: 'history-page-b',
  slug: 'history-page-b',
  title: '다른 페이지',
  blocks: [{ id: 'other-block', type: 'hero', visible: true, s: { title: '다른 페이지' } }],
};
syncPageHistoryPage(otherPage);
assert(!getPageHistoryState().canUndo && !getPageHistoryState().canRedo, 'switching pages must clear the previous page history');

const draftMutationsSource = await readFile('src/runtime/pageDraftMutations.js', 'utf8');
const editMutationsSource = await readFile('src/runtime/pageEditMutations.js', 'utf8');
const hookSource = await readFile('src/runtime/usePageHistoryControls.js', 'utf8');
const panelHeaderSource = await readFile('src/builder/PanelHeader.jsx', 'utf8');
const stylesSource = await readFile('src/styles/editor-page-history.css', 'utf8');
const stylesEntrySource = await readFile('src/styles.css', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const qaAllSource = await readFile('scripts/qa-all.mjs', 'utf8');

assert(draftMutationsSource.includes('recordPageHistoryMutation(current, normalized)'), 'all committed page edits must enter undo history');
assert(editMutationsSource.includes('bindPageHistoryRuntime({ setPage, commitLocalPageDraft })'), 'history runtime must be bound to the current React page setter');
assert(hookSource.includes("key === 'z'") && hookSource.includes("key === 'y'") && hookSource.includes('event.ctrlKey || event.metaKey'), 'Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl/Cmd+Y shortcuts must be supported');
assert(hookSource.includes("[role=\"dialog\"][aria-modal=\"true\"]"), 'history shortcuts must not run behind an open modal');
assert(panelHeaderSource.includes('panel-history-btn is-undo') && panelHeaderSource.includes('panel-history-btn is-redo'), 'editor header must render undo and redo buttons');
assert(panelHeaderSource.includes('disabled={!history.canUndo}') && panelHeaderSource.includes('disabled={!history.canRedo}'), 'history controls must expose disabled states');
assert(panelHeaderSource.includes('aria-label="실행 취소"') && panelHeaderSource.includes('aria-label="다시 실행"'), 'history icon buttons must have accessible names');
assert(stylesSource.includes('.panel-history-actions') && stylesEntrySource.includes("@import './styles/editor-page-history.css';"), 'page history control styles must be loaded');
assert(packageJson.scripts?.['page:history:qa'] === 'node scripts/page-history-quality-check.mjs', 'page:history:qa package script is missing');
assert(qaAllSource.includes("['page:history:qa', ['scripts/page-history-quality-check.mjs']]"), 'qa:all must enforce page history QA');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-undo-redo',
  maxSteps: PAGE_HISTORY_MAX_STEPS,
  typingWindowMs: PAGE_HISTORY_TYPING_WINDOW_MS,
  keyboard: ['Ctrl/Cmd+Z', 'Ctrl/Cmd+Shift+Z', 'Ctrl/Cmd+Y'],
  structuralStepsIndependent: true,
  serverIdentityPreserved: true,
  pageSwitchIsolation: true,
}, null, 2));
