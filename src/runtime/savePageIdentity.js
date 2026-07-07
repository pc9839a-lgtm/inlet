import { fetchPublicServerPage } from '../lib/pageRepository.js';
import { normalizePageForSave } from '../lib/pageModel.js';
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
  if (!authUser || hasServerIdentity(sourcePage)) return sourcePage;

  const localIdentity = latestPage || currentPage;
  const slug = sanitizePageSlug(sourcePage?.slug || localIdentity?.slug || '', '');
  if (!slug) return sourcePage;

  const sourceWithSlug = { ...sourcePage, slug };
  const context = projectContext(sourceWithSlug, authUser);

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
