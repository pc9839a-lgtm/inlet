import { recordPageEditMutation } from './pageEditHistory.js';

export function markLocalPageMutation(localPageMutationRef) {
  localPageMutationRef.current += 1;
}

export function commitLocalPageDraft({ nextPage, normalizePageForSave, latestPageRef, markLocalPageMutation }) {
  const previousPage = latestPageRef.current;
  const normalized = normalizePageForSave(nextPage);
  recordPageEditMutation(previousPage, normalized);
  latestPageRef.current = normalized;
  markLocalPageMutation();
  return normalized;
}

/** Materialize explicitly confirmed, un-applied panel drafts on the newest page. */
export function applyPendingEditorDrafts(page, { theme = null, blocks = null, codeDrafts = {} } = {}) {
  const currentBlocks = Array.isArray(blocks) ? blocks : (page.blocks || []);
  return {
    ...page,
    theme: theme ? { ...(page.theme || {}), ...theme } : page.theme,
    blocks: currentBlocks.map((block) => {
      if (block.type !== 'code' || !Object.prototype.hasOwnProperty.call(codeDrafts, block.id)) return block;
      return {
        ...block,
        s: { ...(block.s || {}), html: codeDrafts[block.id], css: '', js: '', runJs: false },
      };
    }),
  };
}
