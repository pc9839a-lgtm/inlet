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
