import { fetchPublicServerPage, fetchServerPage, persistPage } from '../lib/pageRepository.js';
import { projectContext } from '../lib/projectContext.js';
import { normalize, normalizePageForSave } from '../lib/pageModel.js';
import { buildPageRevisionDiff } from '../lib/pageRevisionDiff.js';
import { save as saveJson, storageErrorMessage } from '../lib/storage.js';
import { saveConflictDraft } from './localConflictDrafts.js';
import { STORAGE_KEY } from '../config/storageKeys.js';
import { isPageConflictError } from './conflictUtils.js';
import { clearPageDraft, restorePageDraft } from '../runtime/pageDraftStore.js';
import { cancelPageSavedIndicatorReset, schedulePageSavedIndicatorReset } from '../runtime/pagePersistFlow.js';
import { pageOperationIdentity } from '../runtime/pageOperationIdentity.js';
import { assertValidPageSaveResult } from '../lib/pageSaveResultValidation.js';
import { setWorkspaceUnsavedDirty } from '../runtime/workspaceUnsavedGuard.js';

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
  // discover the recovered project identity from the read-only public page,
  // then load the complete private page with the signed-in session.
  // Never use the stripped public payload as an editable server copy.
  if (slug === 'dyjh') {
    try {
      const publicPage = await fetchPublicServerPage(slug);
      const recoveredProjectId = String(publicPage?.projectId || '').trim();
      if (recoveredProjectId) {
        const recoveredPage = await fetchServerPage(slug, {
          projectId: recoveredProjectId,
          ownerId: String(localPage?.ownerId || authUser?.ownerId || '').trim(),
          slug,
          session: String(authUser?.session || '').trim(),
        });
        if (recoveredPage) return normalize(recoveredPage);
      }
    } catch (error) {
      console.warn('Full dyjh recovery page load after conflict failed:', error);
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
  setSaved = () => {},
  markSaveStatus = () => {},
  latestPageRef = null,
}) {
  const openPageConflict = async (localPage, error) => {
    let serverPage = null;
    try {
      serverPage = await loadLatestConflictPage(localPage, authUser);
    } catch (loadError) {
      console.warn('Latest server page load after conflict failed:', loadError);
    }

    const normalizedLocalPage = normalizePageForSave(localPage);
    let draftResult = null;
    try {
      draftResult = saveConflictDraft(normalizedLocalPage, {
        reason: 'page-save-conflict',
        source: 'conflict-auto',
      });
    } catch (draftError) {
      draftResult = { ok: false, error: draftError };
    }

    setPageConflict({
      localPage: normalizedLocalPage,
      serverPage,
      errorMessage: String(error?.message || error || '서버 저장 충돌'),
      diff: buildPageRevisionDiff(serverPage || {}, normalizedLocalPage),
      draftSaved: !!draftResult?.ok,
      draftSaveError: draftResult?.ok ? '' : storageErrorMessage(draftResult?.error),
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
    // The conflict copy remains in localConflictDrafts, but explicitly choosing
    // the server must not leave this tab's stale recovery draft or unload guard.
    clearPageDraft({ page: pageConflict.localPage, authUser });
    clearPageDraft({ page: nextPage, authUser });
    if (latestPageRef) latestPageRef.current = nextPage;
    window.dispatchEvent(new CustomEvent('builder:conflict-resolution-committed', { detail: { page: nextPage } }));
    cancelPageSavedIndicatorReset(latestPageRef);
    setPage(nextPage);
    saveJson(STORAGE_KEY, nextPage);
    setSaved(false);
    markSaveStatus('info', '최신본 불러옴', '서버에 저장된 최신 페이지를 불러왔습니다.');
    setWorkspaceUnsavedDirty(false);
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
      // Rebase only server-owned identity/version fields. Keeping the local
      // stale revision causes an immediate second conflict on some backends.
      const nextPage = restorePageDraft({
        draft: { page: normalizePageForSave(pageConflict.localPage) },
        serverPage: pageConflict.serverPage,
      });
      const result = await persistPage(nextPage, authUser, {
        tab: 'edit',
        expectedUpdatedAt: latestUpdatedAt,
        expectedRevision: Number(nextPage.revision || 0),
        saveMode: 'update-existing',
        verifyPublic: true,
      });
      assertValidPageSaveResult({
        result,
        requestPage: result?.clientPage || nextPage,
        saveMode: 'update-existing',
        expectedRevision: Number(nextPage.revision || 0),
        requireSaveRequestId: true,
      });
      const savedPage = normalizePageForSave(result.page);
      clearPageDraft({ page: pageConflict.localPage, authUser });
      clearPageDraft({ page: savedPage, authUser });
      if (latestPageRef) latestPageRef.current = savedPage;
      window.dispatchEvent(new CustomEvent('builder:conflict-resolution-committed', { detail: { page: savedPage } }));
      setPage(savedPage);
      saveJson(STORAGE_KEY, savedPage);
      setWorkspaceUnsavedDirty(false);
      setSaved(true);
      schedulePageSavedIndicatorReset({ latestPageRef, setSaved });
      markSaveStatus('success', '발행 완료', '내 작업으로 최신 페이지에 발행했습니다.', {
        savedPageIdentity: pageOperationIdentity(savedPage),
      });
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
