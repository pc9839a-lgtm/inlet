import { fetchPublicServerPage, fetchServerPage, persistPage } from '../lib/pageRepository.js';
import { projectContext } from '../lib/projectContext.js';
import { normalize, normalizePageForSave } from '../lib/pageModel.js';
import { buildPageRevisionDiff } from '../lib/pageRevisionDiff.js';
import { save as saveJson, storageErrorMessage } from '../lib/storage.js';
import { saveConflictDraft } from './localConflictDrafts.js';
import { STORAGE_KEY } from '../config/storageKeys.js';
import { isPageConflictError } from './conflictUtils.js';

async function loadLatestConflictPage(localPage, authUser) {
  const slug = String(localPage?.slug || '').trim();
  let authenticatedError = null;

  try {
    const latestPage = await fetchServerPage(slug, projectContext(localPage, authUser));
    if (latestPage) return normalize(latestPage);
  } catch (error) {
    authenticatedError = error;
    console.warn('Authenticated latest server page load after conflict failed:', error);
  }

  // 2026-08-04 dyjh incident recovery:
  // the restored page can temporarily belong to its recovered project identity,
  // while the signed-in editor still carries the stale local project identity.
  // Use the already public, read-only server copy only for this slug.
  if (slug === 'dyjh') {
    try {
      const publicPage = await fetchPublicServerPage(slug);
      if (publicPage) return normalize(publicPage);
    } catch (error) {
      console.warn('Public dyjh fallback load after conflict failed:', error);
    }
  }

  if (authenticatedError) throw authenticatedError;
  return null;
}

export function usePageConflict({
  authUser,
  pageConflict,
  setPageConflict,
  setPage,
  setStylePreviewTheme,
}) {
  const openPageConflict = async (localPage, error) => {
    let serverPage = null;
    try {
      serverPage = await loadLatestConflictPage(localPage, authUser);
    } catch (loadError) {
      console.warn('Latest server page load after conflict failed:', loadError);
    }

    setPageConflict({
      localPage,
      serverPage,
      errorMessage: String(error?.message || error || '서버 저장 충돌'),
      diff: buildPageRevisionDiff(serverPage || {}, localPage),
      draftSaved: false,
    });
  };

  const handlePageSaveError = async (error, localPage) => {
    if (isPageConflictError(error)) {
      await openPageConflict(localPage, error);
      return true;
    }
    console.warn('Server page save failed:', error);
    return false;
  };

  const useLatestServerPage = () => {
    if (!pageConflict?.serverPage) return;
    const nextPage = normalizePageForSave(pageConflict.serverPage);
    setPage(nextPage);
    saveJson(STORAGE_KEY, nextPage);
    setStylePreviewTheme(null);
    setPageConflict(null);
  };

  const keepLocalPageDraft = () => {
    if (!pageConflict?.localPage) return;
    const result = saveConflictDraft(normalizePageForSave(pageConflict.localPage), {
      reason: 'page-save-conflict',
      source: 'conflict-modal',
    });
    setPageConflict((conflict) => conflict ? {
      ...conflict,
      draftSaved: !!result?.ok,
      draftSaveError: result?.ok ? '' : storageErrorMessage(result?.error),
    } : conflict);
  };

  const forceSaveLocalPage = async () => {
    if (!pageConflict?.localPage || !pageConflict?.serverPage) return false;
    try {
      const latestUpdatedAt = pageConflict.serverPage.updatedAt || pageConflict.serverPage.savedAt || '';
      const nextPage = normalizePageForSave(pageConflict.localPage);
      const result = await persistPage(nextPage, authUser, {
        tab: 'edit',
        expectedUpdatedAt: latestUpdatedAt,
        saveMode: 'update-existing',
        verifyPublic: true,
      });
      const savedPage = normalizePageForSave(result?.page || nextPage);
      setPage(savedPage);
      saveJson(STORAGE_KEY, savedPage);
      setStylePreviewTheme(null);
      setPageConflict(null);
      return true;
    } catch (error) {
      setPageConflict((conflict) => conflict ? {
        ...conflict,
        draftSaveError: `서버 덮어쓰기에 실패했습니다. ${String(error?.message || error)}`,
      } : conflict);
      return false;
    }
  };

  return {
    handlePageSaveError,
    useLatestServerPage,
    keepLocalPageDraft,
    forceSaveLocalPage,
  };
}
