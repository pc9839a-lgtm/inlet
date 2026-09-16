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
