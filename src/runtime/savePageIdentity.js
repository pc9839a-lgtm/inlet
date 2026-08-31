import { fetchAccountPages, fetchPublicServerPage } from '../lib/pageRepository.js';
import { defaultPage, normalizePageForSave } from '../lib/pageModel.js';
import { sanitizePageSlug } from '../lib/pageSlugs.js';
import { projectContext } from '../lib/projectContext.js';

export function hasServerIdentity(page = {}) {
  return !!(String(page?.id || '').trim() && String(page?.projectId || '').trim());
}

export function hasPersistedServerVersion(page = {}) {
  return Number(page?.revision || 0) > 0 || !!String(page?.updatedAt || page?.savedAt || page?.publishedAt || '').trim();
}

export function pageSaveMode(page = {}) {
  return hasServerIdentity(page) && hasPersistedServerVersion(page) ? 'update-existing' : 'create-new';
}

function sameSlug(a = {}, b = {}) {
  const left = sanitizePageSlug(a?.slug || '', '');
  const right = sanitizePageSlug(b?.slug || '', '');
  return !!left && left === right;
}

function ownerId(page = {}) {
  return String(page?.ownerId || page?.ownerAccountId || '').trim();
}

function pageId(page = {}) {
  return String(page?.id || '').trim();
}

function projectId(page = {}) {
  return String(page?.projectId || '').trim();
}

function samePageId(a = {}, b = {}) {
  const left = pageId(a);
  const right = pageId(b);
  return !!left && !!right && left === right;
}

function sameProject(page = {}, expectedProjectId = '') {
  const expected = String(expectedProjectId || '').trim();
  const current = projectId(page);
  return !!expected && !!current && current === expected;
}

function sameOwner(page = {}, authUser = null) {
  const authOwner = String(authUser?.ownerId || '').trim();
  const pageOwner = ownerId(page);
  return !!authOwner && !!pageOwner && authOwner === pageOwner;
}

function matchesSaveContext(identityPage = {}, sourcePage = {}, context = {}, authUser = null, { requireSlug = false } = {}) {
  if (!hasServerIdentity(identityPage)) return false;
  if (requireSlug && !sameSlug(sourcePage, identityPage)) return false;
  if (sameProject(identityPage, context.projectId)) return true;
  if (sameProject(identityPage, context.legacyProjectId)) return true;
  return sameOwner(identityPage, authUser);
}

function accountPageForSave(pages = [], sourcePage = {}, localIdentity = null) {
  if (!Array.isArray(pages)) return null;
  const sourceId = pageId(sourcePage);
  const localId = pageId(localIdentity);
  if (sourceId) {
    const bySourceId = pages.find((candidate) => hasServerIdentity(candidate) && pageId(candidate) === sourceId);
    if (bySourceId) return bySourceId;
  }
  if (localId) {
    const byLocalId = pages.find((candidate) => hasServerIdentity(candidate) && pageId(candidate) === localId);
    if (byLocalId) return byLocalId;
  }
  const sourceProjectId = projectId(sourcePage) || projectId(localIdentity);
  if (sourceProjectId) {
    const byProject = pages.find((candidate) => hasServerIdentity(candidate) && projectId(candidate) === sourceProjectId);
    if (byProject) return byProject;
  }
  return pages.find((candidate) => hasServerIdentity(candidate) && sameSlug(candidate, sourcePage)) || null;
}

function mergeServerIdentity(sourcePage = {}, identityPage = {}) {
  return normalizePageForSave({
    ...sourcePage,
    id: identityPage.id || sourcePage.id,
    projectId: identityPage.projectId || sourcePage.projectId,
    ownerId: identityPage.ownerId || identityPage.ownerAccountId || sourcePage.ownerId,
    revision: identityPage.revision ?? sourcePage.revision,
    createdAt: identityPage.createdAt || sourcePage.createdAt,
    updatedAt: identityPage.updatedAt || sourcePage.updatedAt,
    savedAt: identityPage.savedAt || sourcePage.savedAt,
    publishedAt: identityPage.publishedAt || sourcePage.publishedAt,
  });
}

function stableNewPageId(context = {}, slug = '') {
  const raw = `page_${context.projectId || context.ownerId || 'local'}_${slug || 'my-page'}`;
  return raw.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 180) || `page_${Date.now()}`;
}

export async function attachExistingPageIdentity(sourcePage = {}, {
  authUser = null,
  latestPage = null,
  currentPage = null,
} = {}) {
  if (!authUser) return sourcePage;

  const localIdentity = latestPage || currentPage;
  const slug = sanitizePageSlug(sourcePage?.slug || localIdentity?.slug || '', '');
  if (!slug) return sourcePage;

  const sourceWithSlug = { ...sourcePage, slug };
  const context = projectContext(sourceWithSlug, authUser);

  if (hasServerIdentity(sourcePage)) {
    if (!matchesSaveContext(sourcePage, sourceWithSlug, context, authUser)) {
      const error = new Error('다른 계정의 페이지는 편집하거나 저장할 수 없습니다. 페이지 소유 계정으로 로그인해주세요.');
      error.status = 403;
      error.details = { code: 'PAGE_ACCOUNT_MISMATCH' };
      throw error;
    }
    // Dashboard/open flows can know pageId/projectId before the full page revision has loaded.
    // Treating that shell as create-new makes the server replay the old page without applying edits.
    // Only fast-return when we also know the persisted version; otherwise resolve revision metadata below.
    if (hasPersistedServerVersion(sourcePage)) return sourcePage;
  }

  if (
    hasServerIdentity(localIdentity)
    && hasPersistedServerVersion(localIdentity)
    && (samePageId(localIdentity, sourceWithSlug) || matchesSaveContext(localIdentity, sourceWithSlug, context, authUser))
  ) {
    return mergeServerIdentity(sourcePage, localIdentity);
  }

  try {
    const accountPages = await fetchAccountPages(authUser);
    const accountPage = accountPageForSave(accountPages, sourceWithSlug, localIdentity);
    if (accountPage && matchesSaveContext(accountPage, sourceWithSlug, context, authUser)) {
      return mergeServerIdentity(sourcePage, accountPage);
    }
  } catch (error) {
    console.warn('Account page identity lookup failed:', error);
  }

  try {
    const publicPage = await fetchPublicServerPage(slug);
    if (matchesSaveContext(publicPage, sourceWithSlug, context, authUser, { requireSlug: true })) {
      return mergeServerIdentity(sourcePage, publicPage);
    }
  } catch (error) {
    console.warn('Existing page identity lookup failed:', error);
  }

  return sourcePage;
}

export function pageForAccountSave({
  sourcePage = null,
  currentPage = null,
  latestPage = null,
  authUser = null,
  normalizeFreeEmailIntegrations = (value) => value,
} = {}) {
  const basePage = sourcePage || latestPage || currentPage;
  const normalized = normalizePageForSave(normalizeFreeEmailIntegrations(basePage));
  const currentSlug = normalized.slug || defaultPage.slug || 'my-page';
  if (!authUser) return normalizePageForSave({ ...normalized, slug: currentSlug });
  const context = projectContext({ ...normalized, slug: currentSlug }, authUser);
  return normalizePageForSave({
    ...normalized,
    id: normalized.id || stableNewPageId(context, currentSlug),
    slug: currentSlug,
    projectId: context.projectId,
    ownerId: context.ownerId,
  });
}

export function savedPageFromResult(localPage, serverPage = null) {
  if (!serverPage) return normalizePageForSave(localPage);
  return normalizePageForSave({
    ...localPage,
    id: serverPage.id || localPage.id,
    projectId: serverPage.projectId || localPage.projectId,
    ownerId: serverPage.ownerId || localPage.ownerId,
    revision: serverPage.revision ?? localPage.revision,
    createdAt: serverPage.createdAt || localPage.createdAt,
    updatedAt: serverPage.updatedAt || localPage.updatedAt,
    savedAt: serverPage.savedAt || localPage.savedAt,
    publishedAt: serverPage.publishedAt || localPage.publishedAt,
    integrations: serverPage.integrations || localPage.integrations,
    ownership: serverPage.ownership || localPage.ownership,
    managers: serverPage.managers || localPage.managers,
  });
}
