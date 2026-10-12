import { readFile } from 'node:fs/promises';
import { preserveInactiveFailedSaveDraft } from '../src/runtime/pagePersistFlow.js';
import { readPageDraft, savePageDraftResult } from '../src/runtime/pageDraftStore.js';

import {
  inactivePageSaveMessage,
  isPageOperationTargetActive,
  pageOperationIdentity,
} from '../src/runtime/pageOperationIdentity.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pageA = {
  id: 'page-a',
  slug: 'page-a',
  projectId: 'project-1',
  ownerId: 'owner-1',
  revision: 2,
  updatedAt: '2026-07-31T01:00:00.000Z',
};
const pageAAfterServerSave = {
  ...pageA,
  revision: 3,
  updatedAt: '2026-07-31T01:01:00.000Z',
};
const pageB = {
  id: 'page-b',
  slug: 'page-b',
  projectId: 'project-1',
  ownerId: 'owner-1',
};
const pageAOtherProject = { ...pageA, projectId: 'project-2' };
const pageAOtherOwner = { ...pageA, ownerId: 'owner-2' };

const targetA = pageOperationIdentity(pageA);
assert(targetA === pageOperationIdentity(pageAAfterServerSave), 'server revision metadata must not change the page operation identity');
assert(isPageOperationTargetActive(targetA, pageAAfterServerSave), 'the same page must remain an active save target after server metadata changes');
const renamedDuringSave = { ...pageA, slug: 'new-public-address', title: '주소 수정 중 추가 편집' };
assert(
  isPageOperationTargetActive(targetA, renamedDuringSave),
  'renaming the slug during a save must keep the persisted page active for rebasing and trailing save',
);
assert(
  pageOperationIdentity(pageA) === pageOperationIdentity(renamedDuringSave),
  'published page identity must be keyed by stable page id rather than the editable public slug',
);
const unsavedA = { projectId: 'project-1', ownerId: 'owner-1', slug: 'unsaved-a' };
const unsavedB = { ...unsavedA, slug: 'unsaved-b' };
assert(
  !isPageOperationTargetActive(pageOperationIdentity(unsavedA), unsavedB),
  'before a page id exists, separate draft slugs must not share an operation identity',
);
assert(
  !isPageOperationTargetActive(targetA, { ...pageA, id: 'different-page', slug: pageA.slug }),
  'different persisted page ids must never accept an older save response even with the same slug',
);

assert(!isPageOperationTargetActive(targetA, pageB), 'a different page must invalidate a pending save response');
assert(!isPageOperationTargetActive(targetA, pageAOtherProject), 'a project switch must invalidate a pending save response');
assert(!isPageOperationTargetActive(targetA, pageAOtherOwner), 'an account or owner switch must invalidate a pending save response');
assert(inactivePageSaveMessage('page').includes('현재 페이지는 그대로 유지'), 'inactive page save success must explain that the current page was preserved');
assert(inactivePageSaveMessage('style', true).includes('스타일 저장에 실패'), 'inactive style save failure must use a scoped message');

const recoveryStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); },
  removeItem(key) { this.values.delete(key); },
  get length() { return this.values.size; },
  key(index) { return [...this.values.keys()][index] ?? null; },
};
const recoveryAuthUser = { ownerId: 'owner-1', workspaceId: 'project-1' };
const failedASnapshot = { ...pageA, title: '저장 실패한 A 원본 작업' };
const startedAt = Date.now() - 4000;
const recovered = preserveInactiveFailedSaveDraft({
  page: failedASnapshot,
  authUser: recoveryAuthUser,
  saveStartedAt: startedAt,
  sourceId: 'editor-a',
  storage: recoveryStorage,
});
assert(recovered.ok, 'inactive failed A must be preserved even after the editor navigated to B');
assert(
  readPageDraft({ page: pageA, authUser: recoveryAuthUser, sourceId: 'editor-a', storage: recoveryStorage })?.page?.title === failedASnapshot.title,
  'inactive failure must write A request contents, never the currently active B page',
);
assert(!readPageDraft({ page: pageB, authUser: recoveryAuthUser, sourceId: 'editor-a', storage: recoveryStorage }), 'inactive A recovery must never change B draft');

const newerA = { ...failedASnapshot, title: 'A에서 이후에 추가로 편집한 최신 내용' };
savePageDraftResult({
  page: newerA,
  authUser: recoveryAuthUser,
  editedAt: startedAt + 5000,
  sourceId: 'editor-a',
  storage: recoveryStorage,
});
const keptNewer = preserveInactiveFailedSaveDraft({
  page: failedASnapshot,
  authUser: recoveryAuthUser,
  saveStartedAt: startedAt + 1000,
  sourceId: 'editor-a',
  storage: recoveryStorage,
});
assert(keptNewer.ok && keptNewer.preservedExisting, 'older failed requests must not overwrite a newer A recovery snapshot');
assert(
  readPageDraft({ page: pageA, authUser: recoveryAuthUser, sourceId: 'editor-a', storage: recoveryStorage })?.page?.title === newerA.title,
  'newer edits made before leaving A must remain recoverable after old request fails',
);
const deniedStorage = {
  getItem() { return null; },
  setItem() { const error = new Error('quota'); error.name = 'QuotaExceededError'; error.code = 22; throw error; },
};
const deniedRecovery = preserveInactiveFailedSaveDraft({
  page: failedASnapshot,
  authUser: recoveryAuthUser,
  saveStartedAt: startedAt,
  sourceId: 'editor-denied',
  storage: deniedStorage,
});
assert(deniedRecovery.ok === false && deniedRecovery.reason === 'quota', 'failed inactive recovery must never claim a successful draft backup');

const pageSaveAction = await readFile('src/runtime/usePageSaveAction.js', 'utf8');
const styleSaveAction = await readFile('src/runtime/usePersistStyleSaveAction.js', 'utf8');
const pageConflictSource = await readFile('src/builder/usePageConflict.js', 'utf8');
const feedbackSource = await readFile('src/builder/BuilderFeedback.jsx', 'utf8');
const conflictCss = await readFile('src/styles/panels-create-modal.css', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const qaAllSource = await readFile('scripts/qa-all.mjs', 'utf8');

for (const [label, source] of [
  ['page save', pageSaveAction],
  ['style save', styleSaveAction],
]) {
  assert(source.includes('const targetIdentity = pageOperationIdentity(nextPage);'), `${label} must capture its target before the request`);
  assert(source.includes('const targetIsActive = () => isPageOperationTargetActive(targetIdentity, activePage());'), `${label} must compare the response target with the current page`);
  assert(source.includes("reason: 'inactive-page'"), `${label} must return an explicit inactive-page result`);
  assert(source.split('preserveInactiveFailedSaveDraft({').length - 1 === 2, `${label} must preserve the inactive target draft after both transport and response-validation failures`);
  assert(source.includes('page: nextPage,') && source.includes('saveStartedAt,'), `${label} failure recovery must use the saved A snapshot, not live B editor state`);
  assert(source.includes('clearPageDraft({ page: nextPage, authUser });'), `${label} must clear the completed inactive page draft`);
  assert(source.includes('clearPageDraft({ page: savedTargetPage, authUser });'), `${label} must clear the server-normalized inactive page draft`);
  assert(source.indexOf('if (!targetIsActive())') < source.indexOf('handlePagePersistError({'), `${label} failures must be isolated before opening a conflict UI`);
  assert(source.lastIndexOf('if (!targetIsActive())') < source.indexOf('commitSavedPageResult({'), `${label} successes must be isolated before mutating the visible editor`);
}

assert(pageSaveAction.indexOf("showToast(inactivePageSaveMessage('page'), 'info')") < pageSaveAction.indexOf('setConnectionsEditing(false);'), 'inactive page save feedback must occur before active-page UI mutations');
assert(styleSaveAction.indexOf("showToast(inactivePageSaveMessage('style'), 'info')") < styleSaveAction.indexOf('setStylePreviewTheme(null);'), 'inactive style saves must not clear the next page style draft');

assert(pageConflictSource.includes("source: 'conflict-auto'"), 'save conflicts must auto-preserve the current local work before the user chooses a resolution');
assert(pageConflictSource.includes('draftSaved: !!draftResult?.ok'), 'conflict state must report automatic draft preservation');
assert(feedbackSource.includes('저장 내용이 겹쳤습니다.'), 'conflict dialog must use a short plain-language title');
assert(feedbackSource.includes('내 작업으로 저장'), 'conflict dialog must expose the current-work save action');
assert(feedbackSource.includes('최신본 불러오기'), 'conflict dialog must expose the latest-server action');
assert(!feedbackSource.includes('<strong>현재 작업 임시 보관</strong>'), 'conflict dialog must not require a separate manual draft button');
assert(!feedbackSource.includes('<strong>현재 화면 유지</strong>'), 'conflict dialog must not show a redundant keep-screen action');
assert(feedbackSource.includes('<details className="page-conflict-details">'), 'conflict diff must be collapsed by default');
assert(conflictCss.includes('.page-conflict-modal{width:min(500px,100%)'), 'conflict dialog must use the compact width');
assert(conflictCss.includes('.page-conflict-actions{margin-top:18px;display:grid;grid-template-columns:1fr 1fr'), 'desktop conflict actions must be limited to two compact columns');
assert(conflictCss.includes('@media(max-width:640px)'), 'conflict dialog must include a compact mobile layout');

assert(packageJson.scripts?.['page:operation:isolation:qa'] === 'node scripts/page-operation-isolation-quality-check.mjs', 'page operation isolation package script is missing');
assert(qaAllSource.includes("['page:operation:isolation:qa', ['scripts/page-operation-isolation-quality-check.mjs']]"), 'qa:all must enforce page operation isolation');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-operation-isolation',
  guardedOperations: ['page-save-success', 'page-save-failure', 'style-save-success', 'style-save-failure'],
  identityDimensions: ['project', 'owner', 'stable-page-id-or-draft-slug'],
  renameDuringSaveRetainsIdentity: true,
  inactiveFailedPageDraftRecovery: true,
  newerRecoveryDraftNeverOverwritten: true,
  conflictUx: {
    automaticDraft: true,
    primaryChoices: 2,
    collapsedDiff: true,
    compactMobile: true,
  },
}, null, 2));
