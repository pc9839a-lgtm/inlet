import { readFile } from 'node:fs/promises';
import {
  cancelPageSavedIndicatorReset,
  schedulePageSavedIndicatorReset,
} from '../src/runtime/pagePersistFlow.js';
import { pageOperationIdentity } from '../src/runtime/pageOperationIdentity.js';
import { createSaveStatusMarker, visibleEditorPublishState } from '../src/runtime/saveStatusActions.js';
import {
  assertValidPageSaveResult,
  expectedPageSaveRequestId,
  INVALID_SAVE_RESULT_CODE,
} from '../src/lib/pageSaveResultValidation.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectInvalid(label, options, reason) {
  let error = null;
  try {
    assertValidPageSaveResult(options);
  } catch (caught) {
    error = caught;
  }
  assert(error?.details?.code === INVALID_SAVE_RESULT_CODE, `${label}: invalid save result code missing`);
  assert(error?.details?.reason === reason, `${label}: expected ${reason}, got ${error?.details?.reason || error?.message || 'no error'}`);
  assert(error?.details?.retryable === false, `${label}: malformed success must not be marked transport-retryable`);
  return error;
}

const requestPage = {
  id: 'page-result-qa',
  projectId: 'project-result-qa',
  ownerId: 'owner-result-qa',
  slug: 'result-qa',
  revision: 7,
  updatedAt: '2026-09-02T06:00:00.000Z',
};
const expectedRequestId = expectedPageSaveRequestId(requestPage, 'update-existing', 7);
assert(expectedRequestId === 'update-existing:project-result-qa:page-result-qa:result-qa:7', 'save request id validation must match the repository identity contract');

const validResult = {
  ok: true,
  replayed: false,
  saveMode: 'update-existing',
  saveRequestId: expectedRequestId,
  clientPage: requestPage,
  page: {
    ...requestPage,
    revision: 8,
    updatedAt: '2026-09-02T06:00:01.000Z',
  },
};
assert(assertValidPageSaveResult({
  result: validResult,
  requestPage,
  saveMode: 'update-existing',
  expectedRevision: 7,
  requireSaveRequestId: true,
}) === validResult, 'matching server save response must be accepted');

const replayResult = {
  ok: true,
  replayed: true,
  replayReason: 'same-content-after-revision-conflict',
  clientPage: requestPage,
  page: {
    ...requestPage,
    revision: 8,
    updatedAt: '2026-09-02T06:00:01.000Z',
  },
};
assert(assertValidPageSaveResult({
  result: replayResult,
  requestPage,
  saveMode: 'update-existing',
  expectedRevision: 7,
  requireSaveRequestId: false,
}) === replayResult, 'verified committed-response-loss recovery may omit the original response echo');

assert(assertValidPageSaveResult({ result: { ok: true, mode: 'local' } }).mode === 'local', 'local mode must keep its existing success contract');
expectInvalid('HTTP 200 without ok', {
  result: { ok: false, page: validResult.page },
  requestPage,
  saveMode: 'update-existing',
  expectedRevision: 7,
}, 'response-not-ok');
expectInvalid('HTTP 200 without page', {
  result: { ok: true, saveMode: 'update-existing', saveRequestId: expectedRequestId },
  requestPage,
  saveMode: 'update-existing',
  expectedRevision: 7,
  requireSaveRequestId: true,
}, 'missing-page');
expectInvalid('wrong page id', {
  result: { ...validResult, page: { ...validResult.page, id: 'other-page' } },
  requestPage,
  saveMode: 'update-existing',
  expectedRevision: 7,
  requireSaveRequestId: true,
}, 'page-id-mismatch');
expectInvalid('wrong project id', {
  result: { ...validResult, page: { ...validResult.page, projectId: 'other-project' } },
  requestPage,
  saveMode: 'update-existing',
  expectedRevision: 7,
  requireSaveRequestId: true,
}, 'project-id-mismatch');
expectInvalid('wrong slug', {
  result: { ...validResult, page: { ...validResult.page, slug: 'other-slug' } },
  requestPage,
  saveMode: 'update-existing',
  expectedRevision: 7,
  requireSaveRequestId: true,
}, 'slug-mismatch');
expectInvalid('missing save mode', {
  result: { ...validResult, saveMode: '' },
  requestPage,
  saveMode: 'update-existing',
  expectedRevision: 7,
  requireSaveRequestId: true,
}, 'save-mode-mismatch');
expectInvalid('wrong save request id', {
  result: { ...validResult, saveRequestId: 'update-existing:wrong:request:identity:7' },
  requestPage,
  saveMode: 'update-existing',
  expectedRevision: 7,
  requireSaveRequestId: true,
}, 'save-request-id-mismatch');
expectInvalid('revision did not advance', {
  result: { ...validResult, page: { ...validResult.page, revision: 7 } },
  requestPage,
  saveMode: 'update-existing',
  expectedRevision: 7,
  requireSaveRequestId: true,
}, 'revision-not-advanced');
expectInvalid('invalid saved revision', {
  result: {
    ...validResult,
    saveMode: 'create-new',
    page: { ...validResult.page, revision: 0 },
  },
  requestPage: { ...requestPage, revision: 0 },
  saveMode: 'create-new',
  expectedRevision: 0,
  requireSaveRequestId: false,
}, 'invalid-revision');
expectInvalid('missing saved timestamp', {
  result: { ...validResult, page: { ...validResult.page, updatedAt: '', savedAt: '' } },
  requestPage,
  saveMode: 'update-existing',
  expectedRevision: 7,
  requireSaveRequestId: true,
}, 'missing-save-timestamp');

const pageAction = await readFile('src/runtime/usePageSaveAction.js', 'utf8');
const styleAction = await readFile('src/runtime/usePersistStyleSaveAction.js', 'utf8');
const repository = await readFile('src/lib/pageRepository.js', 'utf8');
const persistFlow = await readFile('src/runtime/pagePersistFlow.js', 'utf8');

for (const [label, source] of [['page', pageAction], ['style', styleAction]]) {
  const validationIndex = source.indexOf('assertValidPageSaveResult({');
  const commitIndex = source.indexOf('commitSavedPageResult({');
  assert(validationIndex >= 0 && commitIndex > validationIndex, `${label}: result identity must be validated before successful commit`);
  assert(source.includes('requestPage: result?.clientPage || nextPage'), `${label}: account-project fallback must validate against the actual client request identity`);
  assert(source.includes('requireSaveRequestId: !result?.replayReason'), `${label}: normal responses must bind to saveRequestId while verified response-loss recovery stays compatible`);
  assert(source.includes("reason: 'invalid-save-result'"), `${label}: malformed success must return a failed cycle so the save queue stops`);
}

assert(repository.includes("identity.mode || 'create-new'") && repository.includes("identity.projectId || 'project'") && repository.includes("Math.max(0, Number(expectedRevision || 0))"), 'validation request id must remain aligned with repository saveRequestId construction');
assert(persistFlow.includes('clearPageDraft({ page: nextPage, authUser })') && persistFlow.includes('setWorkspaceUnsavedDirty(false)'), 'successful commit remains the only path that clears draft and dirty state after validation');
assert((persistFlow.match(/savedPageIdentity: pageOperationIdentity\(savedPage\)/g) || []).length >= 2, 'both immediate save and asynchronous public verification must retain page-scoped success identity');

// ED-R10: A's obsolete completion timeout must never clear B's newer
// successful publish indicator, even if an already-queued callback runs.
const pendingTimers = new Map();
let nextTimerId = 0;
let savedState = false;
const setSavedState = (value) => { savedState = value; };
const schedule = (callback) => {
  const id = ++nextTimerId;
  pendingTimers.set(id, callback);
  return id;
};
const canceledTimers = [];
const cancel = (id) => { canceledTimers.push(id); pendingTimers.delete(id); };
const latestPageRef = { current: { id: 'A', ownerId: 'owner-a', projectId: 'project-a', slug: 'original-a' } };
savedState = true;
assert(schedulePageSavedIndicatorReset({ latestPageRef, setSaved: setSavedState, schedule, cancel }), 'first saved indication must schedule a timeout');
const oldCallback = pendingTimers.get(1);
const ownerScoped = createSaveStatusMarker((value) => { lastSaveStatus = value; });
let lastSaveStatus = {};
ownerScoped('ok', '발행 완료', '', { savedPageIdentity: pageOperationIdentity(latestPageRef.current) });
const aStatus = lastSaveStatus;
latestPageRef.current = { id: 'B', ownerId: 'owner-a', projectId: 'project-a', slug: 'b' };
assert(aStatus.savedPageIdentity !== pageOperationIdentity(latestPageRef.current), 'A success label must be hidden when B becomes active');
savedState = true;
assert(schedulePageSavedIndicatorReset({ latestPageRef, setSaved: setSavedState, schedule, cancel }), 'B success must schedule its own timeout');
assert(canceledTimers.includes(1), 'B save must cancel A timeout');
oldCallback();
assert(savedState === true, 'stale A callback must not dismiss B saved state');
assert(pendingTimers.size === 1, 'only B timeout must be pending');
pendingTimers.get(2)();
assert(savedState === false, 'B timeout must dismiss its own indication');
assert(cancelPageSavedIndicatorReset(latestPageRef) === false, 'settled timeout must release tracking');

savedState = true;
schedulePageSavedIndicatorReset({ latestPageRef, setSaved: setSavedState, schedule, cancel });
assert(cancelPageSavedIndicatorReset(latestPageRef) === true, 'pending changes must cancel a prior success timer');
const abandonedCallback = pendingTimers.get(3);
assert(abandonedCallback === undefined, 'canceled callback must no longer be scheduled');
assert(savedState === true, 'canceling a success timer must not mutate unrelated state');

const savedPageWithRenamedSlug = { ...latestPageRef.current, slug: 'b-renamed' };
assert(pageOperationIdentity(savedPageWithRenamedSlug) === pageOperationIdentity(latestPageRef.current), 'stored page ID must survive slug rename in scoped success indicator');
ownerScoped('warning', '추가 수정 있음');
assert(!Object.hasOwn(lastSaveStatus, 'savedPageIdentity'), 'non-success feedback must not inherit previous page scope');

const headerSource = await readFile('src/builder/PanelHeader.jsx', 'utf8');
const statusSource = await readFile('src/runtime/saveStatusActions.js', 'utf8');
assert(headerSource.includes('visibleEditorPublishState({'), 'header must obtain page-scoped publication status from the policy');
assert(statusSource.includes('savedPageIdentity'), 'success status marker must preserve optional saved page scope');
const publishedStatus = { tone: 'ok', label: '발행됨', savedPageIdentity: pageOperationIdentity(requestPage) };
assert(visibleEditorPublishState({ page: requestPage, saved: false, saveStatus: publishedStatus }).label === '발행됨', 'completed publication must remain visible after the transient saved flash ends');
assert(visibleEditorPublishState({ page: { ...requestPage, id: 'another-page' }, saved: true, saveStatus: publishedStatus }).label !== '발행됨', 'publication state must never leak across pages');

assert(!persistFlow.includes('schedulePageSavedIndicatorReset({ latestPageRef, setSaved })') && persistFlow.includes('cancelPageSavedIndicatorReset(latestPageRef)'), 'save commit must leave persistent page-scoped publish status while pending edits cancel transient timers');
assert(!persistFlow.includes('setTimeout(() => setSaved(false), 1000)'), 'old unscoped independent saved timers must not return');
assert(persistFlow.includes('cancel = (timer) => clearTimeout(timer)') && persistFlow.includes('schedule = (callback, timeout) => setTimeout(callback, timeout)'), 'browser host timer defaults must keep global invocation context during scoped cancellation');


console.log(JSON.stringify({
  ok: true,
  scope: 'page-save-result-validation',
  checks: 20,
  pageIdentityBound: true,
  projectIdentityBound: true,
  revisionAdvanceRequired: true,
  requestIdEchoRequired: true,
  replayRecoveryCompatible: true,
  pageAndStyleParity: true,
  scopedSavedIndicator: true,
  staleTimerCancellation: true,
  pageSwitchAndSlugRename: true,
}, null, 2));
