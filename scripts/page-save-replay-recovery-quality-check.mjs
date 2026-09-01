import { readFile } from 'node:fs/promises';
import { defaultPage, normalizePageForSave } from '../src/lib/pageModel.js';
import {
  isCommittedSaveRetryConflict,
  sameCommittedPageContent,
} from '../src/runtime/pageSaveReplayRecovery.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const savedPage = normalizePageForSave({
  ...defaultPage,
  id: 'page-retry-1',
  projectId: 'project-retry-1',
  ownerId: 'owner-retry-1',
  slug: 'retry-test',
  title: '응답 유실 재시도',
  revision: 7,
  updatedAt: '2026-09-01T04:00:00.000Z',
});

const sameContentNewerRevision = normalizePageForSave({
  ...savedPage,
  revision: 8,
  updatedAt: '2026-09-01T04:00:05.000Z',
});
const divergentContentNewerRevision = normalizePageForSave({
  ...sameContentNewerRevision,
  title: '다른 화면에서 수정된 내용',
});

assert(
  sameCommittedPageContent(savedPage, sameContentNewerRevision),
  'revision/timestamp-only changes must still be recognized as already committed content',
);
assert(
  !sameCommittedPageContent(savedPage, divergentContentNewerRevision),
  'different page content must never be auto-recovered as a committed retry',
);
assert(
  isCommittedSaveRetryConflict({ status: 409, details: { code: 'PAGE_REVISION_CONFLICT' } }),
  'revision conflicts must be eligible for committed-save replay recovery',
);
assert(
  !isCommittedSaveRetryConflict({ status: 409, details: { code: 'PAGE_SLUG_CONFLICT' } }),
  'slug conflicts must never be treated as committed-save retries',
);
assert(
  !isCommittedSaveRetryConflict({ status: 500, details: { code: 'PAGE_REVISION_CONFLICT' } }),
  'non-conflict server failures must not enter committed-save replay recovery',
);

const helperSource = await readFile('src/runtime/pageSaveReplayRecovery.js', 'utf8');
const pageActionSource = await readFile('src/runtime/usePageSaveAction.js', 'utf8');
const styleActionSource = await readFile('src/runtime/usePersistStyleSaveAction.js', 'utf8');

assert(
  helperSource.includes('fetchServerPage(page.slug, projectContext(page, authUser))'),
  'replay recovery must verify the current authoritative server page before declaring success',
);
assert(
  helperSource.includes('sameCommittedPageContent(serverPage, page)'),
  'replay recovery must compare full normalized page content before declaring success',
);
assert(
  pageActionSource.includes('const replayedResult = await recoverCommittedPageSave({ error, page: nextPage, authUser })'),
  'normal page saves must recover response-loss retries before surfacing a conflict',
);
assert(
  styleActionSource.includes('const replayedResult = await recoverCommittedPageSave({ error, page: nextPage, authUser })'),
  'style saves must use the same committed-retry recovery path',
);
assert(
  pageActionSource.includes('if (replayedResult) {\n          result = replayedResult;'),
  'normal page saves must continue through the ordinary successful commit path after replay recovery',
);
assert(
  styleActionSource.includes('if (replayedResult) {\n          result = replayedResult;'),
  'style saves must continue through the ordinary successful commit path after replay recovery',
);

console.log(JSON.stringify({
  ok: true,
  scope: 'page-save-response-loss-retry-recovery',
  sameContentReplay: true,
  divergentContentProtected: true,
  pageAndStyleParity: true,
}, null, 2));
