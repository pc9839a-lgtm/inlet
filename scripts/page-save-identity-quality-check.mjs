import { readFile } from 'node:fs/promises';
import {
  assertExpectedPageVersion,
  assertTargetSlugAvailable,
  assertUpdatePageIdentity,
  pageSaveIdentity,
  resolvePageSaveMode,
} from '../server/pageSavePolicy.mjs';
import {
  attachExistingPageIdentity,
  hasPersistedServerVersion,
  pageForAccountSave,
  pageSaveMode,
} from '../src/runtime/savePageIdentity.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectCode(label, fn, code) {
  let error = null;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  assert(error?.details?.code === code || error?.code === code, `${label}: expected ${code}, got ${error?.details?.code || error?.code || error?.message || 'no error'}`);
  return error;
}

const authUser = {
  ownerId: 'owner-save-qa',
  projectId: 'owner-save-qa-original',
  session: 'session-save-qa',
  role: 'master',
  defaultProject: { projectId: 'owner-save-qa-original', slug: 'original' },
};

assert(pageSaveMode({ slug: 'new-page' }) === 'create-new', 'new local pages must use create-new');
assert(pageSaveMode({ id: 'page-existing', projectId: 'project-existing', revision: 2, updatedAt: '2026-07-30T00:00:00.000Z' }) === 'update-existing', 'persisted pages must use update-existing');
assert(hasPersistedServerVersion({ id: 'page-shell', projectId: 'project-shell' }) === false, 'a dashboard identity shell must not be treated as a loaded persisted revision');
assert(hasPersistedServerVersion({ id: 'page-existing', projectId: 'project-existing', revision: 1 }) === true, 'a positive server revision must be treated as persisted');

const preparedNewA = pageForAccountSave({ sourcePage: { slug: 'new-page', title: 'New' }, authUser });
const preparedNewB = pageForAccountSave({ sourcePage: { slug: 'new-page', title: 'New retry' }, authUser });
assert(preparedNewA.id && preparedNewA.id === preparedNewB.id, 'new page retries must keep a deterministic page id');
assert(preparedNewA.projectId === preparedNewB.projectId, 'new page retries must keep the same project id');

const renamedExisting = await attachExistingPageIdentity({
  id: 'page-existing',
  projectId: 'project-existing',
  ownerId: authUser.ownerId,
  revision: 3,
  updatedAt: '2026-07-30T00:00:00.000Z',
  slug: 'renamed-page',
}, { authUser: { ...authUser, projectId: 'project-existing' } });
assert(renamedExisting.id === 'page-existing' && renamedExisting.slug === 'renamed-page', 'an authorized existing page must keep its identity when the slug changes');

assert(resolvePageSaveMode({ saveMode: 'create-new' }, { id: 'page-new' }) === 'create-new', 'explicit create mode must remain create-new');
assert(resolvePageSaveMode({ saveMode: 'update-existing' }, {}) === 'update-existing', 'explicit update mode must remain update-existing');
assert(resolvePageSaveMode({}, { id: 'page-existing', projectId: 'project-existing', revision: 2 }) === 'update-existing', 'legacy persisted payloads must infer update-existing');

const updateIdentity = pageSaveIdentity({
  saveMode: 'update-existing',
  identity: { pageId: 'page-existing', projectId: 'project-existing', revision: 4 },
}, { slug: 'renamed-page' }, { projectId: 'project-existing' }, 'renamed-page');
assert(updateIdentity.pageId === 'page-existing' && updateIdentity.projectId === 'project-existing', 'server save identity must preserve page and project ids');

assertUpdatePageIdentity({
  mode: 'update-existing',
  identity: updateIdentity,
  currentById: { id: 'page-existing', projectId: 'project-existing' },
});
expectCode('missing update identity', () => assertUpdatePageIdentity({
  mode: 'update-existing',
  identity: { pageId: '', projectId: '' },
  currentById: null,
}), 'PAGE_SAVE_IDENTITY_REQUIRED');
expectCode('mismatched update project', () => assertUpdatePageIdentity({
  mode: 'update-existing',
  identity: updateIdentity,
  currentById: { id: 'page-existing', projectId: 'other-project' },
}), 'PAGE_SAVE_IDENTITY_MISMATCH');

const replay = assertTargetSlugAvailable({
  mode: 'create-new',
  identity: { pageId: 'page-new', projectId: 'project-new', slug: 'new-page' },
  existingPage: { id: 'page-new', projectId: 'project-new', slug: 'new-page' },
  targetProjectId: 'project-new',
});
assert(replay.replayed === true, 'a repeated create request with the same identity must be idempotent');

expectCode('same-project different-page slug collision', () => assertTargetSlugAvailable({
  mode: 'update-existing',
  identity: { pageId: 'page-a', projectId: 'project-a', slug: 'taken' },
  existingPage: { id: 'page-b', projectId: 'project-a', slug: 'taken' },
  targetProjectId: 'project-a',
}), 'PAGE_SLUG_CONFLICT');
expectCode('cross-project slug collision', () => assertTargetSlugAvailable({
  mode: 'create-new',
  identity: { pageId: 'page-a', projectId: 'project-a', slug: 'taken' },
  existingPage: { id: 'page-b', projectId: 'project-b', slug: 'taken' },
  targetProjectId: 'project-a',
}), 'PAGE_SLUG_CONFLICT');

assertExpectedPageVersion({
  expectedUpdatedAt: '2026-07-30T00:00:00.000Z',
  expectedRevision: 4,
  currentPage: { id: 'page-existing', revision: 4, updatedAt: '2026-07-30T00:00:00.000Z' },
});
expectCode('revision conflict', () => assertExpectedPageVersion({
  expectedRevision: 3,
  currentPage: { id: 'page-existing', revision: 4, updatedAt: '2026-07-30T00:00:00.000Z' },
}), 'PAGE_REVISION_CONFLICT');

const pageAction = await readFile('src/runtime/usePageSaveAction.js', 'utf8');
const styleAction = await readFile('src/runtime/usePersistStyleSaveAction.js', 'utf8');
const persistFlow = await readFile('src/runtime/pagePersistFlow.js', 'utf8');
const saveIdentitySource = await readFile('src/runtime/savePageIdentity.js', 'utf8');
const repository = await readFile('src/lib/pageRepository.js', 'utf8');
const hostedRoute = await readFile('functions/api/pages/[slug].js', 'utf8');
const pageLimitMiddleware = await readFile('functions/api/pages/_middleware.js', 'utf8');
const optimizer = await readFile('src/lib/pageSaveOptimizer.js', 'utf8');
const feedbackSource = await readFile('src/runtime/pageSaveFeedback.js', 'utf8');
const saveStatusSource = await readFile('src/runtime/saveStatusActions.js', 'utf8');
const panelHeaderSource = await readFile('src/builder/PanelHeader.jsx', 'utf8');

assert(pageAction.includes('const saveMode = pageSaveMode(saveSourcePage)') && pageAction.includes('expectedRevision'), 'normal page saves must derive mode before adding a new transport identity');
assert(styleAction.includes('const saveMode = pageSaveMode(styleSourcePage)') && styleAction.includes('expectedRevision'), 'style saves must use the same page identity contract');
assert(repository.includes('saveRequestId') && repository.includes('identity,') && repository.includes("if (saveMode === 'update-existing') throw error"), 'page repository must send identity/idempotency metadata and never retarget an existing update to a new project');
assert(hostedRoute.includes("SELECT * FROM pages WHERE id = ? LIMIT 1") && hostedRoute.includes('assertTargetSlugAvailable') && hostedRoute.includes('assertExpectedPageVersion'), 'hosted save route must resolve updates by page id and guard slug/version conflicts');
assert(pageAction.includes('const saveInFlightRef = useRef(null)') && pageAction.includes('if (saveInFlightRef.current) return saveInFlightRef.current'), 'normal page saves must deduplicate rapid repeated clicks while a write is in flight');
assert(styleAction.includes('const styleSaveInFlightRef = useRef(null)') && styleAction.includes('if (styleSaveInFlightRef.current) return styleSaveInFlightRef.current'), 'style saves must deduplicate rapid repeated clicks while a write is in flight');
assert(pageAction.includes('commitPendingLocalChangesAfterSave') && styleAction.includes('commitPendingLocalChangesAfterSave') && persistFlow.includes('rebaseSavedPageIdentity'), 'server responses must preserve edits made while a save is in flight and only advance server identity metadata');
assert(repository.includes('schedulePublicPageSaveVerification') && !repository.includes('await verifyPublicPageSaveAdvisory'), 'public route verification must remain advisory and must not block successful D1 save completion');
assert(repository.includes('publicVerificationTimers') && repository.includes('clearTimeout(previousTimer)') && repository.includes('PUBLIC_VERIFICATION_DEBOUNCE_MS'), 'rapid saves of the same page must coalesce advisory public-route verification reads');
assert(pageLimitMiddleware.includes('canFastPathExistingSave') && pageLimitMiddleware.includes('ownedTargetExists') && pageLimitMiddleware.includes("url.searchParams.get('saveMode') !== 'update-existing'"), 'existing-page save middleware may skip large body parsing only after signed owner/page/project validation');
assert(optimizer.includes('.sort((a, b) => b.bytes - a.bytes)') && optimizer.includes('if (estimatedBytes <= D1_PAGE_JSON_TARGET_BYTES) break'), 'oversized page optimization must compress the largest embedded images only until the safe target is reached');
assert(saveIdentitySource.includes('if (hasPersistedServerVersion(sourcePage)) return sourcePage;') && saveIdentitySource.includes('const accountPages = await fetchAccountPages(authUser)'), 'known page identity without a loaded revision must resolve persisted version metadata instead of replaying create-new');
assert((persistFlow.match(/quietSuccess: true/g) || []).length >= 2, 'server save commits must suppress duplicate internal local-save success status updates');
assert(feedbackSource.includes("title: local ? '브라우저에 저장됨' : '저장됨'") && feedbackSource.includes("message: ''"), 'successful save feedback must stay compact and avoid duplicate title/body copy');
assert(feedbackSource.includes("toast: '저장 실패 · 작업은 자동 보관됨'") && !feedbackSource.includes("'서버 저장에 실패했습니다. ' + detail"), 'save failure toast must be concise and must not expose long transport errors');
assert(saveStatusSource.includes("markSaveStatus('ok', '브라우저에 저장됨', '')") && saveStatusSource.includes("showToast(message, 'error')"), 'local persistence feedback must use compact success/error messaging');
assert(panelHeaderSource.includes("saveStatus.tone === 'warning' || saveStatus.tone === 'error'"), 'editor header must show save status text only for actionable warning/error states');
assert(panelHeaderSource.includes("{saved ? '저장됨' : '저장'}") && !panelHeaderSource.includes("idle: '#6c727e'") && !panelHeaderSource.includes("ok: '#147a50'"), 'normal save state must be represented by the save button without duplicate idle/ok header labels');

console.log(JSON.stringify({ ok: true, checks: 35 }, null, 2));
