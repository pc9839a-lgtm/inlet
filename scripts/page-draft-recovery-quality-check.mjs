import { readFile } from 'node:fs/promises';
import { defaultPage, normalizePageForSave } from '../src/lib/pageModel.js';
import {
  clearPageDraft,
  evaluatePageDraft,
  readPageDraft,
  restorePageDraft,
  savePageDraft,
} from '../src/runtime/pageDraftStore.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const storage = new MemoryStorage();
const authUser = { email: 'owner@example.com', ownerId: 'owner-1', workspaceId: 'project-1' };
const serverPage = normalizePageForSave({
  ...defaultPage,
  id: 'page-1',
  ownerId: 'owner-1',
  projectId: 'project-1',
  slug: 'draft-test',
  title: '서버 저장본',
  revision: 4,
  updatedAt: '2026-07-30T10:00:00.000Z',
  ai: { ...(defaultPage.ai || {}), apiKey: 'server-secret-key' },
  integrations: {
    ...(defaultPage.integrations || {}),
    sheets: { ...(defaultPage.integrations?.sheets || {}), accessTokenRef: 'server-token-ref' },
  },
});
const editedPage = normalizePageForSave({
  ...serverPage,
  title: '저장 전 편집본',
  meta: { ...(serverPage.meta || {}), desc: '브라우저에서 수정한 설명' },
  ai: { ...(serverPage.ai || {}), apiKey: 'draft-secret-key' },
  integrations: {
    ...(serverPage.integrations || {}),
    sheets: { ...(serverPage.integrations?.sheets || {}), accessTokenRef: 'draft-token-ref' },
  },
});
const editedAt = Date.parse('2026-07-30T10:05:00.000Z');
const draft = savePageDraft({ page: editedPage, authUser, editedAt, storage });
assert(draft, 'server page draft must be written');
const rawDraftStorage = [...storage.values.values()].join('\n');
assert(!rawDraftStorage.includes('draft-secret-key'), 'draft storage must redact API keys');
assert(!rawDraftStorage.includes('draft-token-ref'), 'draft storage must redact token references');
assert(readPageDraft({ page: serverPage, authUser, storage })?.page?.title === '저장 전 편집본', 'same account and page must read its draft');
assert(!readPageDraft({ page: serverPage, authUser: { ...authUser, ownerId: 'owner-2' }, storage }), 'drafts must be isolated by owner');

const recoverable = evaluatePageDraft({ draft, serverPage, now: editedAt + 1000 });
assert(recoverable.action === 'restore', `same-revision newer draft must be recoverable: ${JSON.stringify(recoverable)}`);
const restored = restorePageDraft({ draft, serverPage });
assert(restored.title === '저장 전 편집본', 'restored page must contain unsaved edits');
assert(restored.meta?.desc === '브라우저에서 수정한 설명', 'restored page must contain nested unsaved edits');
assert(restored.revision === serverPage.revision && restored.updatedAt === serverPage.updatedAt, 'restored page must retain server revision identity');
assert(restored.ai?.apiKey !== 'draft-secret-key', 'draft recovery must never reintroduce a locally supplied API key');
assert(restored.ai?.apiKey === serverPage.ai?.apiKey, 'draft recovery must preserve the existing client AI key policy');
assert(restored.integrations?.sheets?.accessTokenRef === 'server-token-ref', 'redacted token references must be preserved from the server page');

const newerServer = normalizePageForSave({
  ...serverPage,
  title: '다른 서버 저장본',
  revision: 5,
  updatedAt: '2026-07-30T10:10:00.000Z',
});
const divergentNewerServer = evaluatePageDraft({ draft, serverPage: newerServer, now: editedAt + 1000 });
assert(divergentNewerServer.action === 'conflict' && divergentNewerServer.reason === 'server-revision-changed', `different-content newer server revision must preserve the local draft as a conflict: ${JSON.stringify(divergentNewerServer)}`);

const sameContentNewerServer = normalizePageForSave({
  ...editedPage,
  revision: 5,
  updatedAt: '2026-07-30T10:10:00.000Z',
});
const alreadySaved = evaluatePageDraft({ draft, serverPage: sameContentNewerServer, now: editedAt + 1000 });
assert(alreadySaved.action === 'discard' && alreadySaved.reason === 'same-content', `same-content newer server revision must be treated as already saved: ${JSON.stringify(alreadySaved)}`);

const timestampConflictServer = normalizePageForSave({
  ...serverPage,
  title: '타임스탬프가 바뀐 서버 저장본',
  revision: 4,
  updatedAt: '2026-07-30T10:10:00.000Z',
});
const timestampConflict = evaluatePageDraft({ draft, serverPage: timestampConflictServer, now: editedAt + 1000 });
assert(timestampConflict.action === 'conflict' && timestampConflict.reason === 'server-timestamp-changed', `different-content server timestamp advance must preserve the draft as a conflict: ${JSON.stringify(timestampConflict)}`);

assert(evaluatePageDraft({ draft: { ...draft, editedAt: editedAt - (8 * 24 * 60 * 60 * 1000) }, serverPage, now: editedAt }).reason === 'expired', 'drafts older than seven days must expire');
assert(clearPageDraft({ page: serverPage, authUser, storage }), 'draft clear must succeed');
assert(!readPageDraft({ page: serverPage, authUser, storage }), 'saved or discarded draft must be removed');

const persistenceSource = await readFile('src/runtime/useLocalWorkspacePersistence.js', 'utf8');
const accountLoadSource = await readFile('src/runtime/useAccountWorkspacePage.js', 'utf8');
const persistFlowSource = await readFile('src/runtime/pagePersistFlow.js', 'utf8');
const pageSaveActionSource = await readFile('src/runtime/usePageSaveAction.js', 'utf8');
const styleSaveActionSource = await readFile('src/runtime/usePersistStyleSaveAction.js', 'utf8');
const storageKeysSource = await readFile('src/config/storageKeys.js', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const qaAllSource = await readFile('scripts/qa-all.mjs', 'utf8');

assert(persistenceSource.includes('SERVER_DRAFT_DELAY_MS') && persistenceSource.includes('SERVER_BASELINE_STABILIZE_MS'), 'server draft writes must be debounced after a stable server baseline');
assert(persistenceSource.includes('baseline.revision !== revision') && persistenceSource.includes('baseline.updatedAt !== updatedAt'), 'server revision and timestamp must define the draft baseline');
assert(persistenceSource.includes("window.addEventListener('pagehide', flushDraft)") && persistenceSource.includes("window.addEventListener('beforeunload', flushDraft)"), 'pending edits must flush before the page closes');
assert(persistenceSource.includes("window.addEventListener('popstate', flushDraft)") && persistenceSource.includes("window.addEventListener('hashchange', flushDraft)"), 'browser back and in-app history navigation must flush the active recovery draft');
assert(persistenceSource.includes("document.addEventListener('visibilitychange', handleVisibilityChange)") && persistenceSource.includes("document.visibilityState === 'hidden'"), 'backgrounding or hiding the editor must flush pending recovery work');
assert(persistenceSource.includes('return () => {\n      if (serverDraftTimerRef.current) clearTimeout(serverDraftTimerRef.current);\n      serverDraftTimerRef.current = null;\n      flushPendingDraft();'), 'draft debounce cleanup must synchronously persist pending edits instead of cancelling them');
assert(persistenceSource.includes('useLayoutEffect(() => {\n    latestPageRef.current = page;'), 'latest page reference must update before paint so exit recovery sees the newest committed editor state');
assert(persistenceSource.includes("event.type === 'input' || event.type === 'change' || event.type === 'keydown'") && persistenceSource.includes('serverDraftDirtyRef.current = true;'), 'direct edit intent must mark recovery work dirty before delayed persistence runs');
assert(accountLoadSource.includes("new CustomEvent('builder:confirm'") && accountLoadSource.includes("confirmLabel: conflict ? '내 임시본 복원' : '임시본 복원'") && accountLoadSource.includes("cancelLabel: '서버 저장본 유지'"), 'page load must offer explicit draft recovery and conflict choices');
assert(accountLoadSource.includes("evaluation.action === 'restore' || evaluation.action === 'conflict'") && accountLoadSource.includes("title: conflict ? '서버와 다른 임시 편집본이 있습니다.'"), 'divergent newer server state must surface as an explicit local draft conflict instead of being silently discarded');
assert(accountLoadSource.includes('if (!recoverable)') && accountLoadSource.includes('clearPageDraft({ page: serverPage, authUser, sourceId: draft.sourceId })'), 'only non-recoverable drafts should clear the selected recovery source automatically');
assert(accountLoadSource.includes('const loadKey =') && accountLoadSource.includes('context.projectId') && accountLoadSource.includes('if (accountPageLoadRef.current !== loadKey) return;') && accountLoadSource.includes('return () => { alive = false; };'), 'late server responses must be rejected by page/project-scoped load identity and effect cleanup');
assert(accountLoadSource.includes("if ((current.slug || '') !== slug) return;"), 'server responses must still match the selected page slug before draft recovery');
assert(persistFlowSource.includes('clearPageDraft({ page: nextPage, authUser })') && persistFlowSource.includes('clearPageDraft({ page: savedPage, authUser })'), 'successful server saves must clear only the active account draft');
assert(persistFlowSource.includes('recoveryPage = page') && persistFlowSource.includes('preserveRecoveryDraft(recoveryPage, authUser)'), 'failed server saves must immediately preserve the latest recovery page');
assert(persistFlowSource.includes('recoveryPage = currentPage') && persistFlowSource.includes('rebaseSavedPageIdentity(recoveryPage, result?.page)') && persistFlowSource.includes('preserveRecoveryDraft(rebasedRecoveryPage, authUser)'), 'edits made during a successful save must be rebased to the new server revision and snapshotted immediately');
assert(pageSaveActionSource.includes('recoveryPage: activePage()') && pageSaveActionSource.includes('authUser,'), 'page save failures must snapshot the currently active edited page');
assert(styleSaveActionSource.includes('recoveryPageWithLatestStyle') && styleSaveActionSource.includes('latestStylePreviewThemeRef.current') && styleSaveActionSource.includes('latestStylePreviewBlocksRef.current'), 'style recovery must include the latest pending preview theme and blocks');
assert(styleSaveActionSource.includes('recoveryPage: recoveryPageWithLatestStyle(activePage())') && styleSaveActionSource.includes('recoveryPage: recoveryPageWithLatestStyle(currentAfterSave)'), 'style save failures and save-race success must both persist a complete recovery draft');
assert(storageKeysSource.includes("PAGE_DRAFTS_KEY = 'inlet-page-drafts-v1'"), 'page draft storage key must be versioned');
assert(packageJson.scripts?.['page:draft:qa'] === 'node scripts/page-draft-recovery-quality-check.mjs', 'package page:draft:qa script missing');
assert(qaAllSource.includes("['page:draft:qa', ['scripts/page-draft-recovery-quality-check.mjs']]"), 'qa:all must enforce draft recovery QA');

console.log(JSON.stringify({
  ok: true,
  scope: 'server-page-draft-recovery',
  debounceMs: 550,
  baselineStabilizeMs: 1200,
  expiryDays: 7,
  sensitiveFieldsRedacted: true,
  clientAiKeyPolicyPreserved: true,
  serverRevisionGuard: true,
  pageSwitchGuard: true,
  browserExitFlush: true,
  browserBackFlush: true,
  hiddenTabFlush: true,
  cleanupFlush: true,
  latestPageLayoutSync: true,
  clearAfterSave: true,
  scopedDraftClear: true,
  immediateFailureSnapshot: true,
  saveRaceRecoverySnapshot: true,
  pendingStyleRecoverySnapshot: true,
  sameContentNewerRevisionDiscarded: true,
  divergentNewerRevisionPreservedAsConflict: true,
  divergentNewerTimestampPreservedAsConflict: true,
  explicitConflictChoiceRequired: true,
}, null, 2));
