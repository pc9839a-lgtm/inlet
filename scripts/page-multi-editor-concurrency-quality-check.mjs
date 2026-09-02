import { readFile } from 'node:fs/promises';
import { defaultPage, normalizePageForSave } from '../src/lib/pageModel.js';
import {
  clearPageDraft,
  readPageDraft,
  savePageDraft,
} from '../src/runtime/pageDraftStore.js';
import { remotePageFreshnessDecision } from '../src/runtime/usePageRemoteFreshness.js';

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
  id: 'page-concurrency-1',
  ownerId: 'owner-1',
  projectId: 'project-1',
  slug: 'concurrency-test',
  title: '서버 기준본',
  revision: 10,
  updatedAt: '2026-09-02T00:00:00.000Z',
});
const tabAPage = normalizePageForSave({ ...serverPage, title: '탭 A 미저장 작업' });
const tabBPage = normalizePageForSave({ ...serverPage, title: '탭 B 미저장 작업' });

const tabADraft = savePageDraft({
  page: tabAPage,
  authUser,
  sourceId: 'tab-a',
  editedAt: Date.parse('2026-09-02T00:01:00.000Z'),
  storage,
});
const tabBDraft = savePageDraft({
  page: tabBPage,
  authUser,
  sourceId: 'tab-b',
  editedAt: Date.parse('2026-09-02T00:02:00.000Z'),
  storage,
});
assert(tabADraft?.sourceId === 'tab-a' && tabBDraft?.sourceId === 'tab-b', 'each editor tab must own a distinct draft source');
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
  updatedAt: '2026-09-02T00:03:00.000Z',
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
  updatedAt: '2026-09-02T00:03:00.000Z',
});
const sameContentDecision = remotePageFreshnessDecision({
  baselinePage: serverPage,
  currentPage: localDirtyPage,
  serverPage: sameContentRemotePage,
});
assert(sameContentDecision.action === 'adopt-server' && sameContentDecision.reason === 'same-content-newer-server', `same content saved elsewhere must rebase to the new server revision: ${JSON.stringify(sameContentDecision)}`);

const draftStoreSource = await readFile('src/runtime/pageDraftStore.js', 'utf8');
const accountWorkspaceSource = await readFile('src/runtime/useAccountWorkspacePage.js', 'utf8');
const remoteFreshnessSource = await readFile('src/runtime/usePageRemoteFreshness.js', 'utf8');
const persistFlowSource = await readFile('src/runtime/pagePersistFlow.js', 'utf8');
const qaAllSource = await readFile('scripts/qa-all.mjs', 'utf8');

assert(draftStoreSource.includes("DRAFT_SOURCE_SESSION_KEY = 'inlet-page-draft-source-v1'"), 'draft source id must be stable for a browser tab session');
assert(draftStoreSource.includes('draftStorageKey(identity, resolvedSourceId)'), 'draft storage keys must include the editor source id');
assert(draftStoreSource.includes('includeOtherSources = false'), 'foreign drafts must not be read during ordinary active-tab persistence');
assert(accountWorkspaceSource.includes('includeOtherSources: true'), 'page-load recovery must still discover orphaned drafts from a closed tab');
assert(accountWorkspaceSource.includes('sourceId: draft.sourceId'), 'recovery cancel/discard must clear the exact selected draft source');
assert(accountWorkspaceSource.includes('usePageRemoteFreshness({'), 'workspace page lifecycle must watch for saves from another tab or device');
assert(remoteFreshnessSource.includes("window.addEventListener('focus', checkRemoteFreshness)"), 'remote freshness must re-check when the editor regains focus');
assert(remoteFreshnessSource.includes("document.addEventListener('visibilitychange', handleVisibility)"), 'remote freshness must re-check when a background tab becomes visible');
assert(remoteFreshnessSource.includes('savePageDraft({') && remoteFreshnessSource.includes("decision.action === 'preserve-local'"), 'remote divergence must snapshot local work before warning');
assert(remoteFreshnessSource.includes('clearPageDraft({ page: activePage, authUser })') && remoteFreshnessSource.includes("decision.action === 'adopt-server'"), 'clean local state may discard only its own stale draft when adopting the server');
assert(!persistFlowSource.includes('allSources: true'), 'ordinary save success must never delete recovery drafts owned by another editor tab');
assert(qaAllSource.includes("['page:concurrency:qa', ['scripts/page-multi-editor-concurrency-quality-check.mjs']]"), 'release QA must enforce multi-editor concurrency protections');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-multi-editor-concurrency',
  protections: {
    perTabDraftIsolation: true,
    crossTabDraftClearIsolation: true,
    orphanedDraftRecovery: true,
    focusRemoteRefresh: true,
    visibilityRemoteRefresh: true,
    remoteCleanAutoAdopt: true,
    remoteDivergenceLocalSnapshot: true,
    sameContentRevisionRebase: true,
  },
}, null, 2));
