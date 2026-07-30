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
assert(restored.ai?.apiKey === 'server-secret-key', 'redacted API keys must be preserved from the server page');
assert(restored.integrations?.sheets?.accessTokenRef === 'server-token-ref', 'redacted token references must be preserved from the server page');

const newerServer = { ...serverPage, revision: 5, updatedAt: '2026-07-30T10:10:00.000Z' };
assert(evaluatePageDraft({ draft, serverPage: newerServer, now: editedAt + 1000 }).action === 'discard', 'newer server revision must invalidate a local draft');
assert(evaluatePageDraft({ draft: { ...draft, editedAt: editedAt - (8 * 24 * 60 * 60 * 1000) }, serverPage, now: editedAt }).reason === 'expired', 'drafts older than seven days must expire');
assert(clearPageDraft({ page: serverPage, authUser, storage }), 'draft clear must succeed');
assert(!readPageDraft({ page: serverPage, authUser, storage }), 'saved or discarded draft must be removed');

const persistenceSource = await readFile('src/runtime/useLocalWorkspacePersistence.js', 'utf8');
const accountLoadSource = await readFile('src/runtime/useAccountWorkspacePage.js', 'utf8');
const persistFlowSource = await readFile('src/runtime/pagePersistFlow.js', 'utf8');
const storageKeysSource = await readFile('src/config/storageKeys.js', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const qaAllSource = await readFile('scripts/qa-all.mjs', 'utf8');

assert(persistenceSource.includes('SERVER_DRAFT_DELAY_MS') && persistenceSource.includes('SERVER_BASELINE_STABILIZE_MS'), 'server draft writes must be debounced after a stable server baseline');
assert(persistenceSource.includes('baseline.revision !== revision') && persistenceSource.includes('baseline.updatedAt !== updatedAt'), 'server revision and timestamp must define the draft baseline');
assert(persistenceSource.includes("window.addEventListener('pagehide', flushDraft)") && persistenceSource.includes("window.addEventListener('beforeunload', flushDraft)"), 'pending edits must flush before the page closes');
assert(accountLoadSource.includes("new CustomEvent('builder:confirm'") && accountLoadSource.includes("confirmLabel: '임시본 복원'"), 'page load must offer explicit draft recovery');
assert(accountLoadSource.includes("evaluation.action !== 'restore'") && accountLoadSource.includes('clearPageDraft'), 'stale drafts must be discarded instead of restored');
assert(accountLoadSource.includes("(current.slug || '') !== slug") && accountLoadSource.includes("(current.projectId || '') !== (context.projectId || '')"), 'late server responses must not restore drafts into another page');
assert(persistFlowSource.includes('clearPageDraft({ page: nextPage })') && persistFlowSource.includes('clearPageDraft({ page: savedPage })'), 'successful server saves must clear local drafts');
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
  serverRevisionGuard: true,
  pageSwitchGuard: true,
  clearAfterSave: true,
}, null, 2));
