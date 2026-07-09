import { STORAGE_KEY } from '../config/storageKeys.js';
import { persistPage } from '../lib/pageRepository.js';
import { attachExistingPageIdentity } from './savePageIdentity.js';
import { PAGE_SAVE_LABEL, STYLE_SAVED_TOAST, pageSaveErrorFeedback, pageSaveSuccessFeedback } from './pageSaveFeedback.js';

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
    latestPageRef.current = nextPage;
    setPage(nextPage);
    saveLocalJson(STORAGE_KEY, nextPage, PAGE_SAVE_LABEL);
    let result = null;
    try {
      result = await persistPage(nextPage, authUser, { tab: 'style', expectedUpdatedAt, saveMode: 'update-existing' });
    } catch (error) {
      const handled = await handlePageSaveError(error, nextPage);
      const feedback = pageSaveErrorFeedback(error, handled);
      markSaveStatus(feedback.level, feedback.title, feedback.message);
      if (feedback.toast) showToast(feedback.toast, feedback.level);
      return;
    }
    setStylePreviewTheme(null);
    setStylePreviewBlocks(null);
    setConnectionsEditing(false);
    if (result?.page) {
      const savedPage = savedPageFromResult(nextPage, result.page);
      latestPageRef.current = savedPage;
      setPage(savedPage);
      saveLocalJson(STORAGE_KEY, savedPage, PAGE_SAVE_LABEL);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1000);
    const feedback = pageSaveSuccessFeedback(result, 'style');
    markSaveStatus(feedback.level, feedback.title, feedback.message);
    showToast(STYLE_SAVED_TOAST, 'success');
  };

  return { persistStyleNow };
}