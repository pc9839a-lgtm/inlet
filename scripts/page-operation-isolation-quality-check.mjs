import { readFile } from 'node:fs/promises';
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
assert(!isPageOperationTargetActive(targetA, pageB), 'a different page must invalidate a pending save response');
assert(!isPageOperationTargetActive(targetA, pageAOtherProject), 'a project switch must invalidate a pending save response');
assert(!isPageOperationTargetActive(targetA, pageAOtherOwner), 'an account or owner switch must invalidate a pending save response');
assert(inactivePageSaveMessage('page').includes('현재 페이지는 그대로 유지'), 'inactive page save success must explain that the current page was preserved');
assert(inactivePageSaveMessage('style', true).includes('스타일 저장에 실패'), 'inactive style save failure must use a scoped message');

const pageSaveAction = await readFile('src/runtime/usePageSaveAction.js', 'utf8');
const styleSaveAction = await readFile('src/runtime/usePersistStyleSaveAction.js', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const qaAllSource = await readFile('scripts/qa-all.mjs', 'utf8');

for (const [label, source] of [
  ['page save', pageSaveAction],
  ['style save', styleSaveAction],
]) {
  assert(source.includes('const targetIdentity = pageOperationIdentity(nextPage);'), `${label} must capture its target before the request`);
  assert(source.includes('const targetIsActive = () => isPageOperationTargetActive(targetIdentity, activePage());'), `${label} must compare the response target with the current page`);
  assert(source.includes("reason: 'inactive-page'"), `${label} must return an explicit inactive-page result`);
  assert(source.includes('clearPageDraft({ page: nextPage, authUser });'), `${label} must clear the completed inactive page draft`);
  assert(source.includes('clearPageDraft({ page: savedTargetPage, authUser });'), `${label} must clear the server-normalized inactive page draft`);
  assert(source.indexOf('if (!targetIsActive())') < source.indexOf('handlePagePersistError({'), `${label} failures must be isolated before opening a conflict UI`);
  assert(source.lastIndexOf('if (!targetIsActive())') < source.indexOf('commitSavedPageResult({'), `${label} successes must be isolated before mutating the visible editor`);
}

assert(pageSaveAction.indexOf("showToast(inactivePageSaveMessage('page'), 'info')") < pageSaveAction.indexOf('setConnectionsEditing(false);'), 'inactive page save feedback must occur before active-page UI mutations');
assert(styleSaveAction.indexOf("showToast(inactivePageSaveMessage('style'), 'info')") < styleSaveAction.indexOf('setStylePreviewTheme(null);'), 'inactive style saves must not clear the next page style draft');
assert(packageJson.scripts?.['page:operation:isolation:qa'] === 'node scripts/page-operation-isolation-quality-check.mjs', 'page operation isolation package script is missing');
assert(qaAllSource.includes("['page:operation:isolation:qa', ['scripts/page-operation-isolation-quality-check.mjs']]"), 'qa:all must enforce page operation isolation');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-operation-isolation',
  guardedOperations: ['page-save-success', 'page-save-failure', 'style-save-success', 'style-save-failure'],
  identityDimensions: ['project', 'owner', 'page-id', 'slug'],
}, null, 2));
