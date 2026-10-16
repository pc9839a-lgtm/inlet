import { EVENTS_KEY, LEADS_KEY } from '../config/storageKeys.js';

const SOURCES = Object.freeze([
  { kind: 'leads', key: LEADS_KEY },
  { kind: 'events', key: EVENTS_KEY },
]);

// Inspect original browser storage, never a list hydrated from a server response.
// Historic local records are not necessarily scoped to the currently open page.
export function inspectLegacyLocalData(storage) {
  const items = [];
  for (const { kind, key } of SOURCES) {
    let raw = null;
    try {
      raw = storage?.getItem(key) ?? null;
    } catch {
      items.push({ kind, key, count: 0, bytes: 0, unreadable: true, invalid: false });
      continue;
    }
    if (raw === null) continue;
    let count = 0;
    let invalid = false;
    try {
      const value = JSON.parse(raw);
      if (!Array.isArray(value)) invalid = true;
      else count = value.length;
    } catch {
      invalid = true;
    }
    if (invalid || count > 0) {
      items.push({ kind, key, count, bytes: raw.length, invalid, unreadable: false });
    }
  }
  return {
    items,
    total: items.reduce((sum, item) => sum + item.count, 0),
    needsAttention: items.length > 0,
    hasErrors: items.some(item => item.invalid || item.unreadable),
  };
}

// Lossless manual archive. Never upload, delete, or mark any records migrated.
// Do not include session/auth/page data in a PII migration archive.
export function buildLegacyLocalArchive(storage, exportedAt = new Date().toISOString()) {
  const inspection = inspectLegacyLocalData(storage);
  if (!inspection.needsAttention) throw new Error('백업할 브라우저 접수·이벤트 데이터가 없습니다.');
  if (inspection.items.some(item => item.unreadable)) throw new Error('로컬 저장소를 읽을 수 없습니다. 브라우저 권한을 확인한 뒤 다시 시도하세요.');
  const snapshots = {};
  for (const item of inspection.items) {
    const raw = storage?.getItem(item.key);
    if (typeof raw !== 'string') throw new Error('로컬 데이터가 변경되었습니다. 다시 확인한 뒤 백업하세요.');
    snapshots[item.key] = raw;
  }
  return {
    format: 'pagero-legacy-local-recovery',
    version: 1,
    exportedAt,
    status: 'local-backup-only-not-imported',
    warning: '개인정보가 포함될 수 있습니다. 이 파일을 안전하게 보관하고 공개 장소에 공유하지 마세요.',
    snapshots,
  };
}


// Only explicitly project-scoped, identifiable rows may reach the server
// importer. Unscoped/mixed-project rows stay in the manual recovery archive.
export function collectScopedLegacyRows(storage, context = {}) {
  const eligible = { leads: [], events: [] };
  let excluded = 0;
  const projectId = String(context.projectId || '').trim();
  const slug = String(context.slug || '').trim();
  if (!projectId || !slug) return { eligible, excluded: 0, unreadable: true, reason: '프로젝트를 먼저 선택하세요.' };
  for (const { kind, key } of SOURCES) {
    let rows;
    try {
      const raw = storage?.getItem(key);
      rows = raw === null || raw === undefined ? [] : JSON.parse(raw);
    } catch {
      return { eligible, excluded: 0, unreadable: true, reason: '로컬 원본을 읽을 수 없습니다.' };
    }
    if (!Array.isArray(rows)) return { eligible, excluded: 0, unreadable: true, reason: '로컬 자료의 형식이 올바르지 않습니다.' };
    for (const item of rows) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) { excluded++; continue; }
      const ids = [item.projectId, item.project?.projectId, item.project?.id]
        .filter(value => value !== undefined && value !== null && String(value).trim());
      const slugs = [item.pageSlug, item.page?.slug, item.project?.slug]
        .filter(value => value !== undefined && value !== null && String(value).trim());
      if (!ids.length || ids.some(x => String(x) !== projectId)
        || slugs.some(x => String(x) !== slug)
        || !/^[a-zA-Z0-9_-]{1,120}$/.test(String(item.id || ''))
        || (kind === 'events' && !String(item.type || item.eventType || '').trim())) {
        excluded++;
        continue;
      }
      eligible[kind].push(item);
    }
  }
  return { eligible, excluded, unreadable: false, reason: '' };
}
