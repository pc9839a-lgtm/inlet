import { useRef } from 'react';
import { persistPage } from '../lib/pageRepository.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import { STORAGE_KEY } from '../config/storageKeys.js';
import { clearPageDraft } from './pageDraftStore.js';
import { inactivePageSaveMessage, isPageOperationTargetActive, pageOperationIdentity } from './pageOperationIdentity.js';
import { attachExistingPageIdentity, pageSaveMode } from './savePageIdentity.js';
import {
  SAVE_BLOCKED_FEEDBACK,
  STYLE_CONFIRM_FEEDBACK,
  WRITE_BLOCKED_FEEDBACK,
} from './pageSaveFeedback.js';
import { commitSavedPageResult, handlePagePersistError } from './pagePersistFlow.js';

function rebaseServerIdentity(currentPage = {}, serverPage = null) {
  if (!serverPage) return normalizePageForSave(currentPage);
  return normalizePageForSave({
    ...currentPage,
    id: serverPage.id || currentPage.id,
    projectId: serverPage.projectId || currentPage.projectId,
    ownerId: serverPage.ownerId || currentPage.ownerId,
    revision: serverPage.revision ?? currentPage.revision,
    createdAt: serverPage.createdAt || currentPage.createdAt,
    updatedAt: serverPage.updatedAt || currentPage.updatedAt,
    savedAt: serverPage.savedAt || currentPage.savedAt,
    publishedAt: serverPage.publishedAt || currentPage.publishedAt,
  });
}

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

  const executeSave = async (pageOverride = null) => {
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
      await handlePagePersistError({ error, page: nextPage, handlePageSaveError, markSaveStatus, showToast });
      return { ok: false, error };
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
      const rebasedPage = rebaseServerIdentity(currentAfterSave, result?.page);
      latestPageRef.current = rebasedPage;
      setPage(rebasedPage);
      saveLocalJson(STORAGE_KEY, rebasedPage, '페이지');
      setConnectionsEditing(false);
      setSaved(false);
      markSaveStatus('warning', '서버 저장 완료', '저장 중 추가로 수정한 내용이 있습니다. 현재 화면은 한 번 더 저장해주세요.');
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
      latestPageRef,
      savedPageFromResult,
      saveLocalJson,
      setPage,
      setSaved,
      markSaveStatus,
    });
    return { ok: true, page: savedPage, result };
  };

  const saveNow = (pageOverride = null) => {
    if (saveInFlightRef.current) return saveInFlightRef.current;
    const task = executeSave(pageOverride);
    saveInFlightRef.current = task;
    task.finally(() => {
      if (saveInFlightRef.current === task) saveInFlightRef.current = null;
    });
    return task;
  };

  return { saveNow };
}