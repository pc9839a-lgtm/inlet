import { useRef } from 'react';
import { persistPage } from '../lib/pageRepository.js';
import { clearPageDraft } from './pageDraftStore.js';
import { inactivePageSaveMessage, isPageOperationTargetActive, pageOperationIdentity } from './pageOperationIdentity.js';
import { recoverCommittedPageSave } from './pageSaveReplayRecovery.js';
import { attachExistingPageIdentity, pageSaveMode } from './savePageIdentity.js';
import { nextTrailingSaveRequest } from './saveQueuePolicy.js';
import { STYLE_SAVED_TOAST } from './pageSaveFeedback.js';
import {
  commitPendingLocalChangesAfterSave,
  commitSavedPageResult,
  handlePagePersistError,
} from './pagePersistFlow.js';

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
  const styleSaveInFlightRef = useRef(null);
  const queuedStyleSaveRef = useRef(false);
  const latestStylePreviewThemeRef = useRef(stylePreviewTheme);
  const latestStylePreviewBlocksRef = useRef(stylePreviewBlocks);
  latestStylePreviewThemeRef.current = stylePreviewTheme;
  latestStylePreviewBlocksRef.current = stylePreviewBlocks;

  const recoveryPageWithLatestStyle = (currentPage) => ({
    ...currentPage,
    theme: latestStylePreviewThemeRef.current
      ? { ...currentPage.theme, ...latestStylePreviewThemeRef.current }
      : currentPage.theme,
    blocks: latestStylePreviewBlocksRef.current || currentPage.blocks,
  });

  const persistStyleNow = async () => {
    if (styleSaveInFlightRef.current) {
      queuedStyleSaveRef.current = true;
      markSaveStatus('warning', '저장 대기', '현재 저장이 끝나면 최신 스타일을 이어서 저장합니다.');
      return styleSaveInFlightRef.current;
    }

    const task = (async () => {
      let finalResult = null;

      while (true) {
        finalResult = await runStyleSaveCycle();
        const queued = queuedStyleSaveRef.current;
        queuedStyleSaveRef.current = false;
        const next = nextTrailingSaveRequest({
          result: finalResult,
          queued,
          queuedRequest: true,
          automaticRequest: finalResult?.pendingChanges ? true : null,
        });

        if (!next.continue) break;
        markSaveStatus('warning', '추가 수정 저장 중', '저장 중 변경된 최신 스타일을 이어서 저장합니다.');
      }

      return finalResult;
    })();

    styleSaveInFlightRef.current = task;
    try {
      return await task;
    } finally {
      if (styleSaveInFlightRef.current === task) styleSaveInFlightRef.current = null;
      queuedStyleSaveRef.current = false;
    }
  };

  async function runStyleSaveCycle() {
    if (blockWrite('style')) return { ok: false, reason: 'write-blocked' };
    const basePage = latestPageRef.current || page;
    const previewThemeAtSave = latestStylePreviewThemeRef.current;
    const previewBlocksAtSave = latestStylePreviewBlocksRef.current;
    const styleSourcePage = await attachExistingPageIdentity({
      ...basePage,
      theme: previewThemeAtSave ? { ...basePage.theme, ...previewThemeAtSave } : basePage.theme,
      blocks: previewBlocksAtSave || basePage.blocks,
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
      const replayedResult = await recoverCommittedPageSave({ error, page: nextPage, authUser });
      if (replayedResult) {
        result = replayedResult;
      } else {
        await handlePagePersistError({
          error,
          page: nextPage,
          recoveryPage: recoveryPageWithLatestStyle(activePage()),
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
      showToast(inactivePageSaveMessage('style'), 'info');
      return {
        ok: true,
        page: activePage(),
        savedPage: savedTargetPage,
        result,
        reason: 'inactive-page',
      };
    }

    const currentAfterSave = activePage();
    const changedWhileSaving = currentAfterSave !== basePage
      || latestStylePreviewThemeRef.current !== previewThemeAtSave
      || latestStylePreviewBlocksRef.current !== previewBlocksAtSave;

    if (changedWhileSaving) {
      setConnectionsEditing(false);
      const rebasedPage = commitPendingLocalChangesAfterSave({
        result,
        currentPage: currentAfterSave,
        recoveryPage: recoveryPageWithLatestStyle(currentAfterSave),
        authUser,
        latestPageRef,
        saveLocalJson,
        setPage,
        setSaved,
        markSaveStatus,
        message: '저장 중 변경된 스타일을 자동으로 이어서 저장합니다.',
      });
      return {
        ok: true,
        page: rebasedPage,
        savedPage: result?.page || null,
        result,
        pendingChanges: true,
      };
    }

    setStylePreviewTheme(null);
    setStylePreviewBlocks(null);
    setConnectionsEditing(false);
    const savedPage = commitSavedPageResult({
      result,
      nextPage,
      scope: 'style',
      authUser,
      latestPageRef,
      savedPageFromResult,
      saveLocalJson,
      setPage,
      setSaved,
      markSaveStatus,
    });
    showToast(STYLE_SAVED_TOAST, 'success');
    return { ok: true, page: savedPage, result };
  }

  return { persistStyleNow };
}
