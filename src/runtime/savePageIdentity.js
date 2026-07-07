import { fetchPublicServerPage } from '../lib/pageRepository.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import { sanitizePageSlug } from '../lib/pageSlugs.js';

function hasServerIdentity(page = {}) {
  return !!(page?.id && page?.projectId);
}

function sameSlug(a = {}, b = {}) {
  const left = sanitizePageSlug(a?.slug || '', '');
  const right = sanitizePageSlug(b?.slug || '', '');
  return !!left && left === right;
}

function sameOwner(page = {}, authUser = null) {
  const authOwner = String(authUser?.ownerId || '').trim();
  const pageOwner = String(page?.ownerId || page?.ownerAccountId || '').trim();
  if (!authOwner || !pageOwner) return true;
  return authOwner === pageOwner;
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
  if (hasServerIdentity(localIdentity) && sameSlug(sourcePage, localIdentity) && sameOwner(localIdentity, authUser)) {
    return mergeServerIdentity(sourcePage, localIdentity);
  }

  const slug = sanitizePageSlug(sourcePage?.slug || localIdentity?.slug || '', '');
  if (!slug) return sourcePage;

  try {
    const publicPage = await fetchPublicServerPage(slug);
    if (publicPage && sameOwner(publicPage, authUser)) {
      return mergeServerIdentity(sourcePage, publicPage);
    }
  } catch (error) {
    console.warn('Existing page identity lookup failed:', error);
  }

  return sourcePage;
}
