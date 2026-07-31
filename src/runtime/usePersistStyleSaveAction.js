import { persistPage } from '../lib/pageRepository.js';
import { clearPageDraft } from './pageDraftStore.js';
import { inactivePageSaveMessage, isPageOperationTargetActive, pageOperationIdentity } from './pageOperationIdentity.js';
import { attachExistingPageIdentity, pageSaveMode } from './savePageIdentity.js';
import { STYLE_SAVED_TOAST } from './pageSaveFeedback.js';
import { commitSavedPageResult, handlePagePersistError } from './pagePersistFlow.js';

export function usePersistStyleSaveAction({
  page,
  authUser,
  latestPageRef,
  stylePreviewTheme,
  stylePreviewBlocks,
  blockWrite,
  pageForAccountSave,
  savedPageFromResult,
  handlePageSaveError,
  markSaveStatus,
  saveLocalJson,
  showToast,
  setPage,
  setStylePreviewTheme,
  setStylePreviewBlocks,
  setConnectionsEditing,
  setSaved,
}) {
  const persistStyleNow = async () => {
    if (blockWrite('style')) return { ok: false, reason: 'write-blocked' };
    const basePage = latestPageRef.current || page;
    const styleSourcePage = await attachExistingPageIdentity({
      ...basePage,
      theme: stylePreviewTheme ? { ...basePage.theme, ...stylePreviewTheme } : basePage.theme,
      blocks: stylePreviewBlocks || basePage.blocks,
    }, {
      authUser,
      latestPage: latestPageRef.current,
      currentPage: page,
    });
    const saveMode = pageSaveMode(styleSourcePage);
    const nextPage = pageForAccountSave(styleSourcePage);
    const targetIdentity = pageOperationIdentity(nextPage);
    const activePage = () => latestPageRef.current || page;
    const targetIsActive = () => isPageOperationTargetActive(targetIdentity, activePage());
    const expectedUpdatedAt = styleSourcePage.updatedAt || styleSourcePage.savedAt || styleSourcePage.createdAt || page.updatedAt || page.savedAt || page.createdAt || '';
    const expectedRevision = Number(styleSourcePage.revision || 0);
    let result = null;
    try {
      if (saveMode === 'update-existing') {
        result = await persistPage(nextPage, authUser, { tab: 'style', expectedUpdatedAt, saveMode: 'update-existing' });
      } else {
        result = await persistPage(nextPage, authUser, { tab: 'style', expectedUpdatedAt, expectedRevision, saveMode: 'create-new' });
      }
    } catch (error) {
      if (!targetIsActive()) {
        showToast(inactivePageSaveMessage('style', true), 'error');
        return { ok: false, error, reason: 'inactive-page', page: activePage() };
      }
      await handlePagePersistError({ error, page: nextPage, handlePageSaveError, markSaveStatus, showToast });
      return { ok: false, error };
    }

    if (!targetIsActive()) {
      const persistedClientPage = result?.clientPage || nextPage;
      const savedTargetPage = result?.page ? savedPageFromResult(persistedClientPage, result.page) : persistedClientPage;
      clearPageDraft({ page: nextPage, authUser });
      clearPageDraft({ page: savedTargetPage, authUser });
      showToast(inactivePageSaveMessage('style'), 'info');
      return {
        ok: true,
        page: activePage(),
        savedPage: savedTargetPage,
        result,
        reason: 'inactive-page',
      };
    }

    setStylePreviewTheme(null);
    setStylePreviewBlocks(null);
    setConnectionsEditing(false);
    const savedPage = commitSavedPageResult({
      result,
      nextPage,
      scope: 'style',
      latestPageRef,
      savedPageFromResult,
      saveLocalJson,
      setPage,
      setSaved,
      markSaveStatus,
    });
    showToast(STYLE_SAVED_TOAST, 'success');
    return { ok: true, page: savedPage, result };
  };

  return { persistStyleNow };
}
