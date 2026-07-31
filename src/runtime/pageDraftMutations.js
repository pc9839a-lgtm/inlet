import { recordPageHistoryMutation } from './pageHistoryStore.js';

export function markLocalPageMutation(localPageMutationRef) {
  localPageMutationRef.current += 1;
}

export function commitLocalPageDraft({ nextPage, normalizePageForSave, latestPageRef, markLocalPageMutation }) {
  const current = latestPageRef.current;
  const normalized = normalizePageForSave(nextPage);
  recordPageHistoryMutation(current, normalized);
  latestPageRef.current = normalized;
  markLocalPageMutation();
  return normalized;
}
