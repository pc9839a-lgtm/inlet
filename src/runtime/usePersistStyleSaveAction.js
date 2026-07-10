import { persistPage } from '../lib/pageRepository.js';
import { attachExistingPageIdentity } from './savePageIdentity.js';
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
    if (blockWrite('style')) return;
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
    const nextPage = pageForAccountSave(styleSourcePage);
    const expectedUpdatedAt = styleSourcePage.updatedAt || styleSourcePage.savedAt || styleSourcePage.createdAt || page.updatedAt || page.savedAt || page.createdAt || '';
    let result = null;
    try {
      result = await persistPage(nextPage, authUser, { tab: 'style', expectedUpdatedAt, saveMode: 'update-existing' });
    } catch (error) {
      await handlePagePersistError({ error, page: nextPage, handlePageSaveError, markSaveStatus, showToast });
      return;
    }
    setStylePreviewTheme(null);
    setStylePreviewBlocks(null);
    setConnectionsEditing(false);
    commitSavedPageResult({
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
  };

  return { persistStyleNow };
}