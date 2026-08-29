import { persistPage } from '../lib/pageRepository.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import { clearPageDraft } from './pageDraftStore.js';
import { inactivePageSaveMessage, isPageOperationTargetActive, pageOperationIdentity } from './pageOperationIdentity.js';
import { attachExistingPageIdentity, pageSaveMode } from './savePageIdentity.js';
import {
  PUBLIC_VERIFY_DELAYED_TOAST,
  SAVE_BLOCKED_FEEDBACK,
  STYLE_CONFIRM_FEEDBACK,
  WRITE_BLOCKED_FEEDBACK,
} from './pageSaveFeedback.js';
import { commitSavedPageResult, handlePagePersistError, shouldPreservePageDraftAfterSave } from './pagePersistFlow.js';

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
    const saveMode = pageSaveMode(saveSourcePage);
    const expectedUpdatedAt = saveSourcePage.updatedAt || saveSourcePage.savedAt || saveSourcePage.createdAt || sourcePage.updatedAt || sourcePage.savedAt || sourcePage.createdAt || '';
    const expectedRevision = Number(saveSourcePage.revision || 0);
    const nextPage = pageForAccountSave(saveSourcePage);
    const targetIdentity = pageOperationIdentity(nextPage);
    const activePage = () => latestPageRef.current || page;
    const targetIsActive = () => isPageOperationTargetActive(targetIdentity, activePage());
    let result = null;
    try {
      if (saveMode === 'update-existing') {
        result = await persistPage(nextPage, authUser, { tab, expectedUpdatedAt, saveMode: 'update-existing' });
      } else {
        result = await persistPage(nextPage, authUser, { tab, expectedUpdatedAt, expectedRevision, saveMode: 'create-new' });
      }
    } catch (error) {
      if (!targetIsActive()) {
        showToast(inactivePageSaveMessage('page', true), 'error');
        return { ok: false, error, reason: 'inactive-page', page: activePage() };
      }
      await handlePagePersistError({ error, page: nextPage, handlePageSaveError, markSaveStatus, showToast });
      return { ok: false, error };
    }

    if (!targetIsActive()) {
      const persistedClientPage = result?.clientPage || nextPage;
      const savedTargetPage = result?.page ? savedPageFromResult(persistedClientPage, result.page) : persistedClientPage;
      const preserveRecoveryDraft = shouldPreservePageDraftAfterSave(result);
      if (!preserveRecoveryDraft) {
        clearPageDraft({ page: nextPage, authUser });
        clearPageDraft({ page: savedTargetPage, authUser });
      }
      showToast(preserveRecoveryDraft ? PUBLIC_VERIFY_DELAYED_TOAST : inactivePageSaveMessage('page'), preserveRecoveryDraft ? 'warning' : 'info');
      return {
        ok: true,
        page: activePage(),
        savedPage: savedTargetPage,
        result,
        reason: 'inactive-page',
      };
    }

    setConnectionsEditing(false);
    const savedPage = commitSavedPageResult({
      result,
      nextPage,
      scope: 'page',
      latestPageRef,
      savedPageFromResult,
      saveLocalJson,
      setPage,
      setSaved,
      markSaveStatus,
    });
    return { ok: true, page: savedPage, result };
  };

  return { saveNow };
}
