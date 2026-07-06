import { defaultPage, normalizePageForSave } from '../lib/pageModel.js';
import { projectContext } from '../lib/projectContext.js';

export function usePageSaveHelpers({
  page,
  authUser,
  latestPageRef,
  normalizeFreeEmailIntegrations,
}) {
  const pageForAccountSave = (sourcePage = null) => {
    const basePage = sourcePage || latestPageRef.current || page;
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
  };

  const savedPageFromResult = (localPage, serverPage = null) => {
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
  };

  return {
    pageForAccountSave,
    savedPageFromResult,
  };
}