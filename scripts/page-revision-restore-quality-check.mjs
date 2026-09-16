import { readFile } from 'node:fs/promises';
import { PAGE_REVISION_RESTORABLE_KEYS, pageFromRevisionDraft } from '../src/lib/pageRevisionRestore.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const current = {
  id: 'page-current',
  pageId: 'page-current',
  projectId: 'project-current',
  ownerId: 'owner-current',
  ownerAccountId: 'owner-current',
  slug: 'current-slug',
  revision: 9,
  updatedAt: '2026-09-16T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  publishedAt: '2026-09-15T00:00:00.000Z',
  title: '현재 제목',
  theme: { accent: '#111111' },
  meta: { title: '현재 SEO' },
  share: { enabled: true },
  blocks: [{ id: 'current-block', type: 'text', s: { title: '현재' } }],
  settings: { feature: 'current' },
  integrations: { sheets: { accessTokenRef: 'keep-current-token' } },
  ownership: { managers: [{ id: 'keep-manager' }] },
  ai: { apiKey: 'keep-current-ai-key' },
};

const revision = {
  id: 'revision-3',
  revision: 3,
  page: {
    id: 'page-old',
    pageId: 'page-old',
    projectId: 'project-old',
    ownerId: 'owner-old',
    ownerAccountId: 'owner-old',
    slug: 'old-slug',
    revision: 3,
    updatedAt: '2026-03-01T00:00:00.000Z',
    createdAt: '2025-01-01T00:00:00.000Z',
    publishedAt: '2026-03-01T00:00:00.000Z',
    title: '과거 제목',
    theme: { accent: '#abcdef' },
    meta: { title: '과거 SEO' },
    share: { enabled: false },
    blocks: [{ id: 'old-block', type: 'text', s: { title: '과거' } }],
    settings: { feature: 'old' },
    integrations: { sheets: { accessTokenRef: 'old-token' } },
    ownership: { managers: [{ id: 'old-manager' }] },
    ai: { apiKey: 'old-ai-key' },
  },
};

const restored = pageFromRevisionDraft(current, revision);

for (const key of PAGE_REVISION_RESTORABLE_KEYS) {
  assert(JSON.stringify(restored[key]) === JSON.stringify(revision.page[key]), `${key} must restore from the selected revision`);
}

for (const key of ['id', 'pageId', 'projectId', 'ownerId', 'ownerAccountId', 'slug', 'revision', 'updatedAt', 'createdAt', 'publishedAt']) {
  assert(restored[key] === current[key], `${key} must preserve current page identity/version`);
}

assert(restored.integrations.sheets.accessTokenRef === 'keep-current-token', 'revision restore must not roll back integration credentials');
assert(restored.ownership.managers[0].id === 'keep-manager', 'revision restore must not roll back ownership/access');
assert(restored.ai.apiKey === 'keep-current-ai-key', 'revision restore must not roll back AI credentials');

const sectionSource = await readFile('src/panels/settings/PageRevisionHistorySection.jsx', 'utf8');
const settingsBodySource = await readFile('src/panels/settings/SettingsPanelBody.jsx', 'utf8');
const advancedSource = await readFile('src/panels/settings/SettingsAdvancedAndReset.jsx', 'utf8');
const pageRepositorySource = await readFile('src/lib/pageRepository.js', 'utf8');

assert(settingsBodySource.includes("['history', '버전 기록', History]"), 'settings advanced navigation must expose version history');
assert(advancedSource.includes('PageRevisionHistorySection') && advancedSource.includes("activeSection === 'history'"), 'version history section must render from advanced settings');
assert(sectionSource.includes('fetchPageRevisions(page, authUser)'), 'version history UI must use the authenticated revision list API');
assert(sectionSource.includes('pageFromRevisionDraft(page, revision)'), 'version history restore must load a draft into the editor');
assert(sectionSource.includes('저장 버튼을 누르기 전까지 공개 페이지는 변경되지 않습니다.'), 'revision restore UI must explain that public content is unchanged before save');
assert(!sectionSource.includes('restorePageRevision('), 'revision history UI must not call the immediate server restore endpoint');
assert(pageRepositorySource.includes('export async function fetchPageRevisions'), 'page repository must retain the revision list API');
assert(pageRepositorySource.includes('export async function restorePageRevision'), 'legacy direct server restore API may remain available but must not be wired to this UI');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-revision-draft-restore',
  restorableKeys: PAGE_REVISION_RESTORABLE_KEYS,
  identityPreserved: true,
  credentialsPreserved: true,
  immediateServerRestoreUsed: false,
}, null, 2));
