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

// Two distinct new drafts can have identical default slug, owner, and project.
// Their in-memory Undo/Redo stacks must not overlap.
clearPageEditHistory();
await Promise.resolve();
const unsavedDraftA = { slug: 'my-page', projectId: 'project-a', ownerId: 'owner-a', title: 'Draft A0', blocks: [] };
currentPage = unsavedDraftA;
latestPageRef.current = unsavedDraftA;
syncPageEditHistoryScope(currentPage);
currentPage = commitPage({ ...currentPage, title: 'Draft A1' });
currentPage = commitPage({ ...currentPage, title: 'Draft A2' });
await Promise.resolve();
assert(getPageEditHistoryState().undoCount === 2, 'edits to an id-less draft must retain their own undo history');

const unsavedDraftB = { ...unsavedDraftA, title: 'Draft B0' };
currentPage = unsavedDraftB;
latestPageRef.current = unsavedDraftB;
// Simulate Ctrl+Z immediately after B is selected, before the React effect
// has synchronized the newly rendered page in PanelHeader.
undoPageEdit();
await Promise.resolve();
assert(currentPage.title === 'Draft B0', 'old draft A history must never overwrite newly selected draft B via a shortcut');
assert(!getPageEditHistoryState().canUndo, 'stale undo on a newly selected unsaved page must clear the prior page stack');

currentPage = commitPage({ ...currentPage, title: 'Draft B1' });
await Promise.resolve();
assert(getPageEditHistoryState().undoCount === 1, 'draft B edits must have an isolated stack');
assert(undoPageEdit(), 'draft B must still support undo after page isolation');
await Promise.resolve();
assert(currentPage.title === 'Draft B0', 'draft B undo must restore only B content');
assert(redoPageEdit(), 'draft B redo must work');
await Promise.resolve();
assert(currentPage.title === 'Draft B1', 'draft B redo must not restore A content');

const unsavedDraftC = { ...unsavedDraftB, slug: 'draft-c', title: 'Draft C0' };
currentPage = unsavedDraftC;
latestPageRef.current = unsavedDraftC;
syncPageEditHistoryScope(currentPage);
await Promise.resolve();
assert(!getPageEditHistoryState().canUndo && !getPageEditHistoryState().canRedo, 'switching to a different unsaved slug must clear the previous draft history');
currentPage = commitPage({ ...currentPage, title: 'Draft C1' });
await Promise.resolve();
assert(getPageEditHistoryState().undoCount === 1, 'new draft C must record one edit');
currentPage = commitPage({ ...currentPage, slug: 'draft-c-renamed' });
await Promise.resolve();
assert(!getPageEditHistoryState().canUndo, 'an id-less page changing identity must fail safe and reset stale undo history');

const headerSource = await readFile('src/builder/PanelHeader.jsx', 'utf8');
const mutationSource = await readFile('src/runtime/pageEditMutations.js', 'utf8');
assert(headerSource.includes('syncPageEditHistoryScope(page)') && headerSource.includes('}, [page]);'), 'page history must sync when an id-less page object changes, even with identical URL and owner');
const historySource = await readFile('src/runtime/pageEditHistory.js', 'utf8');
assert(historySource.includes('unsavedPageScopes = new WeakMap()') && historySource.includes('carryUnsavedScope(previousPage, nextPage)'), 'draft mutation clones must inherit their original private history identity');
assert(historySource.includes('if (currentScope !== activeScope || pageScope(target) !== currentScope)'), 'Undo and Redo must reject stale page targets before the scope synchronization effect runs');
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
  unsavedSameSlugIsolation: true,
  immediateUndoBeforeEffectGuard: true,
  undoRedoForUnsavedDraft: true,
  canonicalCommitPreserved: true,
}, null, 2));
