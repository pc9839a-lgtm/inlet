import { STORAGE_KEY } from '../config/storageKeys.js';
import { persistPage } from '../lib/pageRepository.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import { attachExistingPageIdentity } from './savePageIdentity.js';
import {
  PAGE_SAVE_LABEL,
  SAVE_BLOCKED_FEEDBACK,
  STYLE_CONFIRM_FEEDBACK,
  WRITE_BLOCKED_FEEDBACK,
  pageSaveErrorFeedback,
  pageSaveSuccessFeedback,
} from './pageSaveFeedback.js';

export function usePageSaveAction({
  allowedTabs,
  tab,
  canWriteCurrentTab,
  hasPendingStyle,
  page,
  authUser,
  latestPageRef,
  requestConfirm,
  persistStyleNow,
  pageForAccountSave,
  savedPageFromResult,
  handlePageSaveError,
  markSaveStatus,
  saveLocalJson,
  showToast,
  setConnectionsEditing,
  setPage,
  setSaved,
}) {
  const saveNow = async (pageOverride = null) => {
    if (!allowedTabs.includes(tab)) {
      markSaveStatus(SAVE_BLOCKED_FEEDBACK.level, SAVE_BLOCKED_FEEDBACK.title, SAVE_BLOCKED_FEEDBACK.message);
      return { ok: false, reason: 'tab-blocked' };
    }
    if (!canWriteCurrentTab) {
      markSaveStatus(WRITE_BLOCKED_FEEDBACK.level, WRITE_BLOCKED_FEEDBACK.title, WRITE_BLOCKED_FEEDBACK.message);
      showToast(WRITE_BLOCKED_FEEDBACK.toast, WRITE_BLOCKED_FEEDBACK.level);
      return { ok: false, reason: 'write-blocked' };
    }
    if (tab === 'style' && hasPendingStyle) {
      requestConfirm({
        title: STYLE_CONFIRM_FEEDBACK.title,
        message: STYLE_CONFIRM_FEEDBACK.message,
        confirmLabel: STYLE_CONFIRM_FEEDBACK.confirmLabel,
        onConfirm: persistStyleNow,
      });
      return { ok: false, reason: 'style-confirm-required' };
    }

    const sourcePage = pageOverride
      ? normalizePageForSave({ ...(latestPageRef.current || page), ...pageOverride })
      : (latestPageRef.current || page);
    const saveSourcePage = await attachExistingPageIdentity(sourcePage, {
      authUser,
      latestPage: latestPageRef.current,
      currentPage: page,
    });
    const expectedUpdatedAt = saveSourcePage.updatedAt || saveSourcePage.savedAt || saveSourcePage.createdAt || sourcePage.updatedAt || sourcePage.savedAt || sourcePage.createdAt || '';
    const nextPage = pageForAccountSave(saveSourcePage);
    let result = null;
    try {
      result = await persistPage(nextPage, authUser, { tab, expectedUpdatedAt, saveMode: 'update-existing' });
    } catch (error) {
      const handled = await handlePageSaveError(error, nextPage);
      const feedback = pageSaveErrorFeedback(error, handled);
      markSaveStatus(feedback.level, feedback.title, feedback.message);
      if (feedback.toast) showToast(feedback.toast, feedback.level);
      return { ok: false, error };
    }
    setConnectionsEditing(false);
    const savedPage = result?.page ? savedPageFromResult(nextPage, result.page) : nextPage;
    latestPageRef.current = savedPage;
    setPage(savedPage);
    saveLocalJson(STORAGE_KEY, savedPage, PAGE_SAVE_LABEL);
    setSaved(true);
    setTimeout(() => setSaved(false), 1000);
    const feedback = pageSaveSuccessFeedback(result, 'page');
    markSaveStatus(feedback.level, feedback.title, feedback.message);
    return { ok: true, page: savedPage, result };
  };

  return { saveNow };
}