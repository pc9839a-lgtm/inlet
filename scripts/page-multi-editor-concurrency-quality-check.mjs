import { readFile } from 'node:fs/promises';
import { defaultPage, normalizePageForSave } from '../src/lib/pageModel.js';
import {
  clearPageDraft,
  readPageDraft,
  savePageDraft,
} from '../src/runtime/pageDraftStore.js';
import {
  REMOTE_VISIBLE_POLL_MS,
  isRemoteDraftClearEventForPage,
  remoteFreshnessRequestStillCurrent,
  remotePageFreshnessDecision,
} from '../src/runtime/usePageRemoteFreshness.js';

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

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }
}

// Keep fixtures inside the seven-day draft retention window. Fixed calendar dates make this
// regression test expire over time and can falsely report cross-tab deletion failures.
const fixtureBaseMs = Date.now() - 10 * 60 * 1000;
const fixtureIso = (offsetMs = 0) => new Date(fixtureBaseMs + offsetMs).toISOString();

const storage = new MemoryStorage();
const authUser = { email: 'owner@example.com', ownerId: 'owner-1', workspaceId: 'project-1' };
const serverPage = normalizePageForSave({
  ...defaultPage,
  id: 'page-concurrency-1',
  ownerId: 'owner-1',
  projectId: 'project-1',
  slug: 'concurrency-test',
  title: '서버 기준본',
  revision: 10,
  updatedAt: fixtureIso(0),
});
const tabAPage = normalizePageForSave({ ...serverPage, title: '탭 A 미저장 작업' });
const tabBPage = normalizePageForSave({ ...serverPage, title: '탭 B 미저장 작업' });

const tabADraft = savePageDraft({
  page: tabAPage,
  authUser,
  sourceId: 'tab-a',
  editedAt: fixtureBaseMs + 60 * 1000,
  storage,
});
const tabBDraft = savePageDraft({
  page: tabBPage,
  authUser,
  sourceId: 'tab-b',
  editedAt: fixtureBaseMs + 2 * 60 * 1000,
  storage,
});
assert(tabADraft?.sourceId === 'tab-a' && tabBDraft?.sourceId === 'tab-b', 'each editor tab must own a distinct draft source');
const durableKeys = [...storage.values.keys()].filter((key) => key.includes('::entry::'));
assert(durableKeys.length === 2 && durableKeys[0] !== durableKeys[1], 'tabs must persist to two independent atomic localStorage keys');
assert(
  !storage.values.has('inlet-page-drafts-v1'),
  'new draft writes must not rewrite the shared legacy JSON envelope where stale interleaved tabs can erase each other',
);
const interleavedStorage = new MemoryStorage();
interleavedStorage.setItem('inlet-page-drafts-v1', JSON.stringify({ version: 1, drafts: {} }));
for (let attempt = 0; attempt < 100; attempt += 1) {
  savePageDraft({ page: { ...tabAPage, title: `A-${attempt}` }, authUser, sourceId: 'race-a', storage: interleavedStorage });
  savePageDraft({ page: { ...tabBPage, title: `B-${attempt}` }, authUser, sourceId: 'race-b', storage: interleavedStorage });
  assert(readPageDraft({ page: serverPage, authUser, sourceId: 'race-a', storage: interleavedStorage })?.page?.title === `A-${attempt}`, 'A must survive an interleaved B write');
  assert(readPageDraft({ page: serverPage, authUser, sourceId: 'race-b', storage: interleavedStorage })?.page?.title === `B-${attempt}`, 'B must survive an interleaved A write');
}
assert(
  JSON.parse(interleavedStorage.getItem('inlet-page-drafts-v1')).drafts
  && Object.keys(JSON.parse(interleavedStorage.getItem('inlet-page-drafts-v1')).drafts).length === 0,
  'new tabs must not modify the legacy shared envelope',
);

assert(readPageDraft({ page: serverPage, authUser, sourceId: 'tab-a', storage })?.page?.title === '탭 A 미저장 작업', 'tab A must read only its own recovery draft');
assert(readPageDraft({ page: serverPage, authUser, sourceId: 'tab-b', storage })?.page?.title === '탭 B 미저장 작업', 'tab B must read only its own recovery draft');
assert(clearPageDraft({ page: serverPage, authUser, sourceId: 'tab-a', storage }), 'tab A draft clear must succeed');
assert(!readPageDraft({ page: serverPage, authUser, sourceId: 'tab-a', storage }), 'saving tab A must clear only tab A recovery draft');
assert(readPageDraft({ page: serverPage, authUser, sourceId: 'tab-b', storage })?.page?.title === '탭 B 미저장 작업', 'saving tab A must not delete tab B recovery draft');
assert(readPageDraft({ page: serverPage, authUser, sourceId: 'tab-c', includeOtherSources: true, storage })?.sourceId === 'tab-b', 'a later browser session must still discover the latest orphaned recovery draft');
assert(clearPageDraft({ page: serverPage, authUser, sourceId: 'tab-b', storage }), 'explicit foreign draft cleanup must succeed after recovery choice');
assert(!readPageDraft({ page: serverPage, authUser, sourceId: 'tab-c', includeOtherSources: true, storage }), 'explicit recovery cleanup must remove the selected foreign draft');

const remoteServerPage = normalizePageForSave({
  ...serverPage,
  title: '다른 탭 또는 기기 저장본',
  revision: 11,
  updatedAt: fixtureIso(3 * 60 * 1000),
});
const cleanDecision = remotePageFreshnessDecision({
  baselinePage: serverPage,
  currentPage: serverPage,
  serverPage: remoteServerPage,
});
assert(cleanDecision.action === 'adopt-server', `clean editor must adopt a newer remote save: ${JSON.stringify(cleanDecision)}`);

const localDirtyPage = normalizePageForSave({ ...serverPage, title: '현재 기기 미저장 작업' });
const conflictDecision = remotePageFreshnessDecision({
  baselinePage: serverPage,
  currentPage: localDirtyPage,
  serverPage: remoteServerPage,
});
assert(conflictDecision.action === 'preserve-local', `divergent local edits must be preserved when another editor saved: ${JSON.stringify(conflictDecision)}`);

const sameContentRemotePage = normalizePageForSave({
  ...localDirtyPage,
  revision: 11,
  updatedAt: fixtureIso(3 * 60 * 1000),
});
const sameContentDecision = remotePageFreshnessDecision({
  baselinePage: serverPage,
  currentPage: localDirtyPage,
  serverPage: sameContentRemotePage,
});
assert(sameContentDecision.action === 'adopt-server' && sameContentDecision.reason === 'same-content-newer-server', `same content saved elsewhere must rebase to the new server revision: ${JSON.stringify(sameContentDecision)}`);

// A publish from tab A removes A's own durable draft. Tab B gets only a
// storage-event hint, then independently fetches the authoritative server copy.
const tabADraftKey = durableKeys.find((key) => key.includes('::entry::') && key.endsWith('::tab-a'));
assert(!!tabADraftKey, 'test must locate the saved tab A draft key');
assert(
  isRemoteDraftClearEventForPage({ key: tabADraftKey, newValue: null }, serverPage, authUser),
  'a matching cross-tab draft removal must request an authenticated server refresh',
);
assert(
  !isRemoteDraftClearEventForPage({ key: tabADraftKey, newValue: 'replacement draft' }, serverPage, authUser),
  'ordinary draft edits must not trigger repeated server reads',
);
assert(
  !isRemoteDraftClearEventForPage({ key: tabADraftKey, newValue: null }, { ...serverPage, id: 'another-page' }, authUser),
  'another page draft clear must not prompt a refresh for the current page',
);
assert(
  !isRemoteDraftClearEventForPage({ key: tabADraftKey, newValue: null }, serverPage, { ...authUser, ownerId: 'different-owner' }),
  'a different owner must not trigger a cross-account freshness request',
);
assert(REMOTE_VISIBLE_POLL_MS >= 30000 && REMOTE_VISIBLE_POLL_MS <= 60000, 'visible-server poll must remain bounded to 30-60 seconds');
assert(
  remoteFreshnessRequestStillCurrent({ requestedPage: serverPage, activePage: localDirtyPage, authUser }),
  'editing without a server revision change should still allow a response to be checked safely',
);
assert(
  !remoteFreshnessRequestStillCurrent({ requestedPage: serverPage, activePage: remoteServerPage, authUser }),
  'a server response initiated before a local publish must never overwrite its newer revision',
);
assert(
  !remoteFreshnessRequestStillCurrent({ requestedPage: serverPage, activePage: { ...serverPage, id: 'page-switched' }, authUser }),
  'a server response for page A must not be applied after the editor switches to page B',
);

const draftStoreSource = await readFile('src/runtime/pageDraftStore.js', 'utf8');
const accountWorkspaceSource = await readFile('src/runtime/useAccountWorkspacePage.js', 'utf8');
const remoteFreshnessSource = await readFile('src/runtime/usePageRemoteFreshness.js', 'utf8');
const persistFlowSource = await readFile('src/runtime/pagePersistFlow.js', 'utf8');
const qaAllSource = await readFile('scripts/qa-all.mjs', 'utf8');

assert(draftStoreSource.includes("DRAFT_SOURCE_SESSION_KEY = 'inlet-page-draft-source-v1'"), 'draft source id must be stable for a browser tab session');
assert(draftStoreSource.includes('draftStorageKey(identity, resolvedSourceId)'), 'draft storage keys must include the editor source id');
assert(draftStoreSource.includes('ISOLATED_DRAFT_PREFIX') && draftStoreSource.includes('writeIsolatedDraft(storage, identity, resolvedSourceId, draft)'), 'new drafts must persist to independent source-scoped keys');
assert(draftStoreSource.includes('const legacyDrafts = readEnvelope(storage).drafts;'), 'old JSON-envelope drafts must remain recoverable after migration');

assert(draftStoreSource.includes('includeOtherSources = false'), 'foreign drafts must not be read during ordinary active-tab persistence');
assert(accountWorkspaceSource.includes('includeOtherSources: true'), 'page-load recovery must still discover orphaned drafts from a closed tab');
assert(accountWorkspaceSource.includes('sourceId: draft.sourceId'), 'recovery cancel/discard must clear the exact selected draft source');
assert(accountWorkspaceSource.includes('usePageRemoteFreshness({'), 'workspace page lifecycle must watch for saves from another tab or device');
assert(remoteFreshnessSource.includes("window.addEventListener('focus', checkRemoteFreshness)"), 'remote freshness must re-check when the editor regains focus');
assert(remoteFreshnessSource.includes("document.addEventListener('visibilitychange', handleVisibility)"), 'remote freshness must re-check when a background tab becomes visible');
assert(
  remoteFreshnessSource.includes('window.setInterval(checkWhileVisible, REMOTE_VISIBLE_POLL_MS)')
    && remoteFreshnessSource.includes("document.visibilityState === 'visible'")
    && remoteFreshnessSource.includes('window.clearInterval(pollTimer)'),
  'visible editors must poll for changes while open; hidden/unmounted editors must not keep polling',
);
assert(
  remoteFreshnessSource.includes("window.addEventListener('storage', handleDraftStorage)")
    && remoteFreshnessSource.includes("window.removeEventListener('storage', handleDraftStorage)"),
  'same-origin draft-clear notifications must be scoped and unsubscribed when switching pages',
);
assert(
  remoteFreshnessSource.includes('baselineRef.current !== baseline')
    && remoteFreshnessSource.includes('remoteFreshnessRequestStillCurrent({ requestedPage: currentPage, activePage, authUser })'),
  'in-flight older server responses must not overwrite newer local saves or switched pages',
);

assert(remoteFreshnessSource.includes('const recoveryDraft = savePageDraft({') && remoteFreshnessSource.includes('다른 곳에서 저장된 변경이 있습니다. 현재 작업은 임시 보관했습니다.'), 'remote divergence must snapshot local work and surface a warning');
assert(remoteFreshnessSource.includes('clearPageDraft({ page: activePage, authUser })') && remoteFreshnessSource.includes("decision.action === 'adopt-server'"), 'clean local state may discard only its own stale draft when adopting the server');
assert(!persistFlowSource.includes('allSources: true'), 'ordinary save success must never delete recovery drafts owned by another editor tab');
assert(qaAllSource.includes("['page:concurrency:qa', ['scripts/page-multi-editor-concurrency-quality-check.mjs']]"), 'release QA must enforce multi-editor concurrency protections');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-multi-editor-concurrency',
  protections: {
    perTabDraftIsolation: true,
    independentAtomicDraftKeys: true,
    interleavedHundredWritesPreserved: true,
    legacyEnvelopeReadCompatibility: true,
    crossTabDraftClearIsolation: true,
    orphanedDraftRecovery: true,
    focusRemoteRefresh: true,
    visibilityRemoteRefresh: true,
    remoteCleanAutoAdopt: true,
    remoteDivergenceLocalSnapshot: true,
    sameContentRevisionRebase: true,
    visiblePollingBounded: true,
    crossTabDraftClearSignal: true,
    outdatedRemoteResponseRejected: true,
  },
}, null, 2));
