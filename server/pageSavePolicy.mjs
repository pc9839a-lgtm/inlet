const SAVE_MODES = new Set(['create-new', 'update-existing']);

function text(value = '') {
  return String(value || '').trim();
}

function number(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function policyError(message, status, code, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = { code, ...details };
  return error;
}

export function resolvePageSaveMode(body = {}, incoming = {}) {
  const explicit = text(body.saveMode || body.mode || body.identity?.mode);
  if (SAVE_MODES.has(explicit)) return explicit;
  const hasPersistedIdentity = !!(
    text(incoming.id || body.identity?.pageId)
    && text(incoming.projectId || body.identity?.projectId)
    && (number(incoming.revision || body.identity?.revision) > 0 || text(incoming.updatedAt || incoming.savedAt))
  );
  return hasPersistedIdentity ? 'update-existing' : 'legacy';
}

export function pageSaveIdentity(body = {}, incoming = {}, project = {}, slug = '') {
  const supplied = body.identity && typeof body.identity === 'object' ? body.identity : {};
  return {
    mode: resolvePageSaveMode(body, incoming),
    pageId: text(supplied.pageId || incoming.id),
    projectId: text(supplied.projectId || incoming.projectId || project.projectId || project.id),
    ownerId: text(supplied.ownerId || incoming.ownerId || incoming.ownerAccountId || project.ownerId || project.ownerAccountId),
    revision: number(supplied.revision ?? incoming.revision),
    slug: text(supplied.slug || incoming.slug || slug),
    requestId: text(body.saveRequestId || supplied.requestId),
  };
}

export function assertUpdatePageIdentity({ mode = 'legacy', identity = {}, currentById = null } = {}) {
  if (mode !== 'update-existing') return currentById;
  if (!identity.pageId || !identity.projectId) {
    throw policyError('Existing page identity is required for update.', 409, 'PAGE_SAVE_IDENTITY_REQUIRED', {
      pageId: identity.pageId || '',
      projectId: identity.projectId || '',
    });
  }
  if (!currentById?.id) {
    throw policyError('Existing page identity could not be found.', 409, 'PAGE_SAVE_IDENTITY_REQUIRED', {
      pageId: identity.pageId,
      projectId: identity.projectId,
    });
  }
  if (text(currentById.id) !== identity.pageId || text(currentById.projectId) !== identity.projectId) {
    throw policyError('Existing page identity does not match the saved page.', 409, 'PAGE_SAVE_IDENTITY_MISMATCH', {
      pageId: identity.pageId,
      projectId: identity.projectId,
    });
  }
  return currentById;
}

export function assertTargetSlugAvailable({
  mode = 'legacy',
  identity = {},
  existingPage = null,
  targetProjectId = '',
} = {}) {
  if (!existingPage?.id) return { replayed: false, page: null };
  const existingId = text(existingPage.id);
  const existingProjectId = text(existingPage.projectId);
  const sameId = !!identity.pageId && existingId === identity.pageId;
  const sameProject = !!targetProjectId && existingProjectId === text(targetProjectId);

  if (sameId && sameProject) {
    return { replayed: mode === 'create-new', page: existingPage };
  }
  if (mode === 'legacy' && sameProject && !identity.pageId) {
    return { replayed: false, page: existingPage };
  }

  throw policyError('Page URL is already in use.', 409, 'PAGE_SLUG_CONFLICT', {
    slug: identity.slug || existingPage.slug || '',
    currentPageId: identity.pageId || '',
    existingPageId: existingId,
  });
}

export function assertExpectedPageVersion({
  expectedUpdatedAt = '',
  expectedRevision = 0,
  currentPage = null,
  slug = '',
} = {}) {
  if (!currentPage) return;
  const expectedAt = text(expectedUpdatedAt);
  const currentAt = text(currentPage.updatedAt);
  const expectedRev = number(expectedRevision);
  const currentRev = number(currentPage.revision);
  const updatedAtConflict = !!expectedAt && !!currentAt && expectedAt !== currentAt;
  const revisionConflict = expectedRev > 0 && currentRev > 0 && expectedRev !== currentRev;
  if (!updatedAtConflict && !revisionConflict) return;

  throw policyError('Page revision conflict', 409, 'PAGE_REVISION_CONFLICT', {
    latest: {
      slug: currentPage.slug || slug,
      title: currentPage.title || '',
      updatedAt: currentPage.updatedAt || '',
      revision: currentRev,
      blocks: Array.isArray(currentPage.blocks) ? currentPage.blocks.length : 0,
    },
    page: currentPage,
    expectedUpdatedAt: expectedAt,
    expectedRevision: expectedRev,
  });
}
