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
const repository = await readFile('src/lib/pageRepository.js', 'utf8');
const hostedRoute = await readFile('functions/api/pages/[slug].js', 'utf8');

assert(pageAction.includes('const saveMode = pageSaveMode(saveSourcePage)') && pageAction.includes('expectedRevision'), 'normal page saves must derive mode before adding a new transport identity');
assert(styleAction.includes('const saveMode = pageSaveMode(styleSourcePage)') && styleAction.includes('expectedRevision'), 'style saves must use the same page identity contract');
assert(repository.includes('saveRequestId') && repository.includes('identity,') && repository.includes("if (saveMode === 'update-existing') throw error"), 'page repository must send identity/idempotency metadata and never retarget an existing update to a new project');
assert(hostedRoute.includes("SELECT * FROM pages WHERE id = ? LIMIT 1") && hostedRoute.includes('assertTargetSlugAvailable') && hostedRoute.includes('assertExpectedPageVersion'), 'hosted save route must resolve updates by page id and guard slug/version conflicts');

console.log(JSON.stringify({ ok: true, checks: 20 }, null, 2));
