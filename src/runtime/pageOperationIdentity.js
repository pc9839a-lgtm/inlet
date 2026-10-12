function text(value) {
  return String(value || '').trim();
}

export function pageOperationIdentity(page = {}) {
  const projectId = text(page.projectId || page.workspaceId || 'project');
  const ownerId = text(page.ownerId || page.ownerAccountId || page.accountId || 'owner');
  const pageId = text(page.id || page.pageId || '');
  const slug = text(page.slug || page.url || 'page');
  // A persisted page keeps its identity when its public URL (slug) is edited.
  // Including slug here wrongly marks a rename during an in-flight save as a
  // switch to another page, skipping reconciliation and the trailing save.
  // Unsaved pages without an id still use the slug as their fallback identity.
  return [projectId, ownerId, pageId ? `id:${pageId}` : `slug:${slug}`]
    .map((part) => encodeURIComponent(part))
    .join(':');
}

export function isPageOperationTargetActive(targetIdentity, currentPage = {}) {
  return !!targetIdentity && targetIdentity === pageOperationIdentity(currentPage);
}

export function inactivePageSaveMessage(scope = 'page', failed = false) {
  if (failed) return scope === 'style'
    ? '이전 페이지의 스타일 저장에 실패했습니다. 현재 페이지는 그대로 유지했습니다.'
    : '이전 페이지 저장에 실패했습니다. 현재 페이지는 그대로 유지했습니다.';
  return scope === 'style'
    ? '이전 페이지의 스타일 저장이 완료되었습니다. 현재 페이지는 그대로 유지했습니다.'
    : '이전 페이지 저장이 완료되었습니다. 현재 페이지는 그대로 유지했습니다.';
}
