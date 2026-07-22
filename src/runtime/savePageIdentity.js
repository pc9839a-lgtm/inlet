import { fetchPublicServerPage } from '../lib/pageRepository.js';
import { defaultPage, normalizePageForSave } from '../lib/pageModel.js';
import { sanitizePageSlug } from '../lib/pageSlugs.js';
import { projectContext } from '../lib/projectContext.js';

function hasServerIdentity(page = {}) {
  return !!(page?.id && page?.projectId);
}

function sameSlug(a = {}, b = {}) {
  const left = sanitizePageSlug(a?.slug || '', '');
  const right = sanitizePageSlug(b?.slug || '', '');
  return !!left && left === right;
}

function ownerId(page = {}) {
  return String(page?.ownerId || page?.ownerAccountId || '').trim();
}

function sameProject(page = {}, projectId = '') {
  const expected = String(projectId || '').trim();
  const current = String(page?.projectId || page?.id || '').trim();
  return !!expected && !!current && current === expected;
}

function sameOwner(page = {}, authUser = null) {
  const authOwner = String(authUser?.ownerId || '').trim();
  const pageOwner = ownerId(page);
  return !!authOwner && !!pageOwner && authOwner === pageOwner;
}

function matchesSaveContext(identityPage = {}, sourcePage = {}, context = {}, authUser = null) {
  if (!hasServerIdentity(identityPage) || !sameSlug(sourcePage, identityPage)) return false;
  if (sameProject(identityPage, context.projectId)) return true;
  if (sameProject(identityPage, context.legacyProjectId)) return true;
  return sameOwner(identityPage, authUser);
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
    if (matchesSaveContext(sourcePage, sourceWithSlug, context, authUser)) return sourcePage;
    const error = new Error('다른 계정의 페이지는 편집하거나 저장할 수 없습니다. 페이지 소유 계정으로 로그인해주세요.');
    error.status = 403;
    error.details = { code: 'PAGE_ACCOUNT_MISMATCH' };
    throw error;
  }

  if (matchesSaveContext(localIdentity, sourceWithSlug, context, authUser)) {
    return mergeServerIdentity(sourcePage, localIdentity);
  }

  try {
    const publicPage = await fetchPublicServerPage(slug);
    if (matchesSaveContext(publicPage, sourceWithSlug, context, authUser)) {
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
