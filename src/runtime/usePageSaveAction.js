import { useRef } from 'react';
import { persistPage } from '../lib/pageRepository.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import { clearPageDraft } from './pageDraftStore.js';
import { inactivePageSaveMessage, isPageOperationTargetActive, pageOperationIdentity } from './pageOperationIdentity.js';
import { recoverCommittedPageSave } from './pageSaveReplayRecovery.js';
import { attachExistingPageIdentity, pageSaveMode } from './savePageIdentity.js';
import {
  SAVE_BLOCKED_FEEDBACK,
  STYLE_CONFIRM_FEEDBACK,
  WRITE_BLOCKED_FEEDBACK,
} from './pageSaveFeedback.js';
import {
  commitPendingLocalChangesAfterSave,
  commitSavedPageResult,
  handlePagePersistError,
} from './pagePersistFlow.js';

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
  const saveInFlightRef = useRef(null);

  const saveNow = async (pageOverride = null) => {
    if (saveInFlightRef.current) return saveInFlightRef.current;

    const task = (async () => {
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
      const sourcePageRef = latestPageRef.current || page;
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
        const replayedResult = await recoverCommittedPageSave({ error, page: nextPage, authUser });
        if (replayedResult) {
          result = replayedResult;
        } else {
          await handlePagePersistError({
            error,
            page: nextPage,
            recoveryPage: activePage(),
            authUser,
            handlePageSaveError,
            markSaveStatus,
            showToast,
          });
          return { ok: false, error };
        }
      }

      if (!targetIsActive()) {
        const persistedClientPage = result?.clientPage || nextPage;
        const savedTargetPage = result?.page ? savedPageFromResult(persistedClientPage, result.page) : persistedClientPage;
        clearPageDraft({ page: nextPage, authUser });
        clearPageDraft({ page: savedTargetPage, authUser });
        showToast(inactivePageSaveMessage('page'), 'info');
        return {
          ok: true,
          page: activePage(),
          savedPage: savedTargetPage,
          result,
          reason: 'inactive-page',
        };
      }

      const currentAfterSave = activePage();
      const changedWhileSaving = currentAfterSave !== sourcePageRef
        && currentAfterSave !== sourcePage
        && currentAfterSave !== saveSourcePage
        && currentAfterSave !== nextPage;

      if (changedWhileSaving) {
        setConnectionsEditing(false);
        const rebasedPage = commitPendingLocalChangesAfterSave({
          result,
          currentPage: currentAfterSave,
          authUser,
          latestPageRef,
          saveLocalJson,
          setPage,
          setSaved,
          markSaveStatus,
        });
        return {
          ok: true,
          page: rebasedPage,
          savedPage: result?.page || null,
          result,
          pendingChanges: true,
        };
      }

      setConnectionsEditing(false);
      const savedPage = commitSavedPageResult({
        result,
        nextPage,
        scope: 'page',
        authUser,
        latestPageRef,
        savedPageFromResult,
        saveLocalJson,
        setPage,
        setSaved,
        markSaveStatus,
      });
      return { ok: true, page: savedPage, result };
    })();

    saveInFlightRef.current = task;
    const clearInFlight = () => {
      if (saveInFlightRef.current === task) saveInFlightRef.current = null;
    };
    task.then(clearInFlight, clearInFlight);
    return task;
  };

  return { saveNow };
}
