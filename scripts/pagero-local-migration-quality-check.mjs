import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LEADS_KEY, EVENTS_KEY, AUTH_KEY } from '../src/config/storageKeys.js';
import { inspectLegacyLocalData, buildLegacyLocalArchive } from '../src/lib/legacyLocalMigration.js';

function storageWith(initial = {}, unreadable = []) {
  const map = new Map(Object.entries(initial));
  let mutation = 0;
  return {
    getItem(key) {
      if (unreadable.includes(key)) throw new Error('denied');
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) { mutation++; map.set(key, value); },
    removeItem(key) { mutation++; map.delete(key); },
    get mutations() { return mutation; },
  };
}

const empty = inspectLegacyLocalData(storageWith({ [LEADS_KEY]: '[]', [EVENTS_KEY]: '[]' }));
assert(!empty.needsAttention && empty.total === 0);
const legacyLeads = '[{"id":"l1","phone":"010-2222-3333","projectId":"legacy-x"},{"id":"l2"}]';
const legacyEvents = '[{"id":"e1","type":"page_view","sourceUrl":"https://example.com/?email=private%40example.com"}]';
const storage = storageWith({
  [LEADS_KEY]: legacyLeads,
  [EVENTS_KEY]: legacyEvents,
  [AUTH_KEY]: 'extremely sensitive signed session',
  'mobile-db-landing-v12-safe-page': '{"apiKey":"secret"}',
});
const summary = inspectLegacyLocalData(storage);
assert(summary.total === 3 && summary.items.length === 2 && !summary.hasErrors);
const archive = buildLegacyLocalArchive(storage, '2026-10-16T11:18:00.000Z');
assert(archive.status === 'local-backup-only-not-imported');
assert(archive.snapshots[LEADS_KEY] === legacyLeads && archive.snapshots[EVENTS_KEY] === legacyEvents, 'archive must preserve raw local snapshots');
assert(!JSON.stringify(archive).includes('extremely sensitive signed session'), 'archive must never include auth session');
assert(!JSON.stringify(archive).includes('apiKey'), 'archive must not include page secrets');
assert(storage.mutations === 0, 'export planning must never change storage or clear local PII');
const malformed = storageWith({ [LEADS_KEY]: '{broken', [EVENTS_KEY]: '[]' });
const bad = inspectLegacyLocalData(malformed);
assert(bad.needsAttention && bad.hasErrors);
assert(buildLegacyLocalArchive(malformed).snapshots[LEADS_KEY] === '{broken', 'invalid JSON must also be backed up losslessly');
const blocked = storageWith({ [LEADS_KEY]: legacyLeads }, [LEADS_KEY]);
assert(inspectLegacyLocalData(blocked).hasErrors, 'read error must not be hidden');
assert.throws(() => buildLegacyLocalArchive(blocked), /읽을 수 없습니다/);
const source = await readFile('src/runtime/useLocalWorkspacePersistence.js', 'utf8');
assert(source.includes("if (isServerLeadMode()) return;") && source.includes("saveLocalJson(LEADS_KEY, leads") && source.includes("saveLocalJson(EVENTS_KEY, events"), 'server mode must preserve existing local legacy data instead of overwriting it with server rows');
const banner = await readFile('src/screens/workspace/LegacyLocalDataBanner.jsx', 'utf8');
const active = await readFile('src/screens/workspace/WorkspaceActivePanel.jsx', 'utf8');
assert(banner.includes('buildLegacyLocalArchive(window.localStorage)') && banner.includes('로컬 원본 백업 (JSON)'), 'backup must be an explicit user click');
assert(!banner.includes('localStorage.removeItem') && !banner.includes('persistLead(') && !banner.includes('persistEvent('), 'banner must not clear or silently upload data');
assert(active.includes('<LegacyLocalDataBanner authUser='), 'workspace must offer the recovery banner in server mode');
console.log(JSON.stringify({ ok: true, name: 'pagero-stmig-local-backup', noSilentMerge: true, preservedMalformedData: true, noAuthExport: true }));
