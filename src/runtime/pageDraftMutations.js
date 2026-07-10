export function markLocalPageMutation(localPageMutationRef) {
  localPageMutationRef.current += 1;
}

export function commitLocalPageDraft({ nextPage, normalizePageForSave, latestPageRef, markLocalPageMutation }) {
  const normalized = normalizePageForSave(nextPage);
  latestPageRef.current = normalized;
  markLocalPageMutation();
  return normalized;
}
