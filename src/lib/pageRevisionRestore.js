const RESTORABLE_KEYS = ['title', 'share', 'theme', 'meta', 'blocks', 'settings'];

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch {}
  }
  return JSON.parse(JSON.stringify(value));
}

export function pageFromRevisionDraft(currentPage = {}, revision = {}) {
  const snapshot = revision?.page && typeof revision.page === 'object' ? revision.page : revision;
  const next = { ...currentPage };

  for (const key of RESTORABLE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(snapshot || {}, key)) continue;
    next[key] = clone(snapshot[key]);
  }

  return next;
}

export function revisionSummary(revision = {}) {
  const blockCount = Number(revision.blocks ?? revision.page?.blocks?.length ?? 0);
  const revisionNumber = Number(revision.revision || revision.page?.revision || 0);
  const timestamp = String(revision.revisionAt || revision.createdAt || revision.page?.updatedAt || '').trim();
  return {
    id: String(revision.id || '').trim(),
    revision: revisionNumber,
    blockCount,
    timestamp,
    title: String(revision.title || revision.page?.title || '').trim(),
  };
}

export const PAGE_REVISION_RESTORABLE_KEYS = RESTORABLE_KEYS;
