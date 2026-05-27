import { STORAGE_KEY } from '../config/storageKeys.js';

const CONFLICT_DRAFT_PREFIX = `${STORAGE_KEY}:page-conflict-draft:`;

export function saveConflictDraft(page, meta = {}) {
  if (!page || typeof localStorage === 'undefined') return { ok: false, error: 'localStorage unavailable' };
  const createdAt = Date.now();
  const key = `${CONFLICT_DRAFT_PREFIX}${createdAt}`;
  try {
    localStorage.setItem(key, JSON.stringify({
      ...page,
      conflictDraftMeta: {
        reason: meta.reason || 'manual-backup',
        source: meta.source || 'settings',
        createdAt,
      },
    }));
    return { ok: true, key, createdAt };
  } catch (error) {
    return { ok: false, error };
  }
}

export function readConflictDrafts(limit = 5) {
  if (typeof localStorage === 'undefined') return [];
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(CONFLICT_DRAFT_PREFIX))
    .map((key) => {
      try {
        const page = JSON.parse(localStorage.getItem(key) || '{}');
        const blocks = Array.isArray(page.blocks) ? page.blocks : [];
        return {
          key,
          page,
          createdAt: Number(key.slice(CONFLICT_DRAFT_PREFIX.length)) || 0,
          title: page.title || page.slug || '로컬 초안',
          blockCount: blocks.length,
          leadCaptureBlocks: blocks.filter((block) => ['form', 'reservation'].includes(block?.type)).length,
          updatedAt: page.updatedAt || page.savedAt || '',
          meta: page.conflictDraftMeta || null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function removeConflictDraft(key) {
  if (!key || typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
}

export function isRestorableConflictDraft(draft) {
  const page = draft?.page;
  return !!(page && typeof page === 'object' && Array.isArray(page.blocks) && page.blocks.length);
}
