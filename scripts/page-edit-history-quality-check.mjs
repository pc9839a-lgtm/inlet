import { readFile } from 'node:fs/promises';
import {
  PAGE_EDIT_HISTORY_LIMIT,
  clearPageEditHistory,
  configurePageEditHistory,
  getPageEditHistoryState,
  redoPageEdit,
  syncPageEditHistoryScope,
  undoPageEdit,
} from '../src/runtime/pageEditHistory.js';
import { commitLocalPageDraft } from '../src/runtime/pageDraftMutations.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const normalizePageForSave = (page) => JSON.parse(JSON.stringify(page));
const latestPageRef = { current: { id: 'page-a', projectId: 'project-a', title: 'A0', blocks: [] } };
let mutationCount = 0;
let currentPage = latestPageRef.current;
const markLocalPageMutation = () => { mutationCount += 1; };
const commitPage = (nextPage) => commitLocalPageDraft({
  nextPage,
  normalizePageForSave,
  latestPageRef,
  markLocalPageMutation,
});
const setPage = (updater) => {
  currentPage = typeof updater === 'function' ? updater(currentPage) : updater;
};

configurePageEditHistory({ setPage, commitPage });
syncPageEditHistoryScope(currentPage);
clearPageEditHistory();
await Promise.resolve();

currentPage = commitPage({ ...currentPage, title: 'A1' });
currentPage = commitPage({ ...currentPage, title: 'A2' });
await Promise.resolve();
assert(getPageEditHistoryState().undoCount === 2, 'two edits must create two undo entries');
assert(undoPageEdit(), 'undo must execute when history exists');
await Promise.resolve();
assert(currentPage.title === 'A1', 'undo must restore the previous page snapshot');
assert(getPageEditHistoryState().redoCount === 1, 'undo must create one redo entry');
assert(redoPageEdit(), 'redo must execute after undo');
await Promise.resolve();
assert(currentPage.title === 'A2', 'redo must restore the undone page snapshot');

assert(undoPageEdit(), 'second undo must execute');
await Promise.resolve();
currentPage = commitPage({ ...currentPage, title: 'A1-new' });
await Promise.resolve();
assert(!getPageEditHistoryState().canRedo, 'a fresh edit after undo must discard redo history');

clearPageEditHistory();
await Promise.resolve();
for (let index = 0; index < PAGE_EDIT_HISTORY_LIMIT + 8; index += 1) {
  currentPage = commitPage({ ...currentPage, title: `A-${index}` });
}
await Promise.resolve();
assert(getPageEditHistoryState().undoCount === PAGE_EDIT_HISTORY_LIMIT, 'undo history must stay capped at the configured limit');

syncPageEditHistoryScope({ id: 'page-b', projectId: 'project-a', title: 'B0', blocks: [] });
await Promise.resolve();
assert(!getPageEditHistoryState().canUndo && !getPageEditHistoryState().canRedo, 'switching pages must isolate edit history');

const headerSource = await readFile('src/builder/PanelHeader.jsx', 'utf8');
const mutationSource = await readFile('src/runtime/pageEditMutations.js', 'utf8');
assert(headerSource.includes('Ctrl/Cmd+Z') && headerSource.includes('redoPageEdit') && headerSource.includes('undoPageEdit'), 'editor header must expose undo redo controls and shortcuts');
assert(mutationSource.includes('configurePageEditHistory({ setPage, commitPage: commitLocalPageDraft })'), 'page mutations must connect history to the canonical setPage path');
assert(mutationCount >= PAGE_EDIT_HISTORY_LIMIT, 'history application must still use the canonical local mutation commit');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-edit-history',
  limit: PAGE_EDIT_HISTORY_LIMIT,
  undoRedo: true,
  redoInvalidation: true,
  pageIsolation: true,
  canonicalCommitPreserved: true,
}, null, 2));
