import { useRef } from 'react';
import { serializeEditorSave } from './editorSaveCoordinator.js';
import { persistPage } from '../lib/pageRepository.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import { assertValidPageSaveResult } from '../lib/pageSaveResultValidation.js';
import { clearPageDraft } from './pageDraftStore.js';
import { inactivePageSaveMessage, isPageOperationTargetActive, pageOperationIdentity } from './pageOperationIdentity.js';
import { recoverCommittedPageSave } from './pageSaveReplayRecovery.js';
import { attachExistingPageIdentity, pageSaveMode } from './savePageIdentity.js';
import { nextTrailingSaveRequest, resolveQueuedPageOverride, resumeExplicitSaveForActivePage } from './saveQueuePolicy.js';
import {
  SAVE_BLOCKED_FEEDBACK,
  WRITE_BLOCKED_FEEDBACK,
} from './pageSaveFeedback.js';
import {
  commitPendingLocalChangesAfterSave,
  commitSavedPageResult,
  handlePagePersistError,
  preserveInactiveFailedSaveDraft,
  settlePendingPublicVerification,
} from './pagePersistFlow.js';
import { attachPublicPageSaveVerification } from './publicPageSaveVerification.js';

export function usePageSaveAction({
  allowedTabs,
  tab,
  canWriteCurrentTab,
  hasPendingStyle,
  hasPendingCode = false,
  applyPendingDrafts,
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
  const queuedSaveRequestRef = useRef(null);
  // An in-flight save can cross renders; confirmations inspect the latest staged drafts.
  const pendingRef = useRef(null);
  pendingRef.current = { hasPendingStyle, hasPendingCode, applyPendingDrafts, persistStyleNow };

  const saveNow = async (pageOverride = null, confirmedDrafts = false) => {
    // PanelHeader passes this callback directly to onClick; a React event
    // must never be interpreted as a page override.
    if (typeof pageOverride?.preventDefault === 'function') pageOverride = null;
    if (saveInFlightRef.current) {
      const queuedPage = pageOverride != null
        ? { ...(latestPageRef.current || page), ...pageOverride }
        : (latestPageRef.current || page);
      queuedSaveRequestRef.current = {
        hasOverride: pageOverride != null,
        pageOverride,
        // Snapshot B at the click time. The queued override must not undo
        // later edits on B when A finally finishes saving.
        basePage: normalizePageForSave(latestPageRef.current || page),
        targetIdentity: pageOperationIdentity(queuedPage),
      };
      markSaveStatus('warning', '저장 대기', '현재 저장이 끝나면 최신 수정분을 이어서 저장합니다.');
      return saveInFlightRef.current;
    }

    const requestedIdentity = pageOperationIdentity(latestPageRef.current || page);
    const task = serializeEditorSave(authUser, async () => {
      let request = pageOverride;
      let finalResult = null;
      let firstCycle = true;

      while (true) {
        // If A was queued behind style publishing and the user switched to B,
        // skip A without skipping an explicit B click already queued by #402.
        // The existing inactive-page branch below may safely drain B.
        finalResult = firstCycle
          && !isPageOperationTargetActive(requestedIdentity, latestPageRef.current || page)
          ? { ok: false, reason: 'inactive-page', page: latestPageRef.current || page }
          : await runSaveCycle(request, firstCycle && confirmedDrafts);
        firstCycle = false;
        const queued = queuedSaveRequestRef.current;
        queuedSaveRequestRef.current = null;
        const latestQueuedPage = latestPageRef.current || finalResult?.page || page;
        // Only a click still targeting the active page can be drained.
        // In particular B's old override must never publish onto page C.
        const queuedIsActive = !!queued
          && queued.targetIdentity === pageOperationIdentity(latestQueuedPage);
        const queuedRequest = queuedIsActive
          ? (queued.hasOverride
            ? resolveQueuedPageOverride({
              basePage: queued.basePage,
              latestPage: latestQueuedPage,
              pageOverride: queued.pageOverride,
            })
            : latestQueuedPage)
          : null;
        const automaticRequest = finalResult?.pendingChanges
          ? (finalResult.page || latestPageRef.current || null)
          : null;
        // Do not discard a save explicitly requested on page B while page A
        // was in flight. Only B's own still-active request may resume.
        const resumedRequest = resumeExplicitSaveForActivePage({
          result: finalResult,
          queuedTargetIdentity: queued?.targetIdentity || '',
          activeTargetIdentity: pageOperationIdentity(latestPageRef.current || page),
          queuedRequest,
        });
        if (resumedRequest) {
          markSaveStatus('warning', '추가 수정 저장 중', '현재 페이지의 저장 요청을 이어서 처리합니다.');
          request = resumedRequest;
          continue;
        }
        const next = nextTrailingSaveRequest({
          result: finalResult,
          queued: queuedIsActive,
          queuedRequest,
          automaticRequest,
        });

        if (!next.continue) break;
        markSaveStatus('warning', '추가 수정 저장 중', '저장 중 변경된 최신 내용을 이어서 저장합니다.');
        request = next.request;
      }

      return finalResult;
    });

    saveInFlightRef.current = task;
    try {
      return await task;
    } finally {
      if (saveInFlightRef.current === task) saveInFlightRef.current = null;
      queuedSaveRequestRef.current = null;
    }
  };

  async function runSaveCycle(pageOverride = null, confirmedDrafts = false) {
    if (!allowedTabs.includes(tab)) {
      markSaveStatus(SAVE_BLOCKED_FEEDBACK.level, SAVE_BLOCKED_FEEDBACK.title, SAVE_BLOCKED_FEEDBACK.message);
      return { ok: false, reason: 'tab-blocked' };
    }
    if (!canWriteCurrentTab) {
      markSaveStatus(WRITE_BLOCKED_FEEDBACK.level, WRITE_BLOCKED_FEEDBACK.title, WRITE_BLOCKED_FEEDBACK.message);
      showToast(WRITE_BLOCKED_FEEDBACK.toast, WRITE_BLOCKED_FEEDBACK.level);
      return { ok: false, reason: 'write-blocked' };
    }
    if (!confirmedDrafts && (pendingRef.current.hasPendingStyle || pendingRef.current.hasPendingCode)) {
      const confirmationTarget = pageOperationIdentity(latestPageRef.current || page);
      requestConfirm({
        title: '미적용 변경을 발행할까요?',
        message: '공통 스타일과 코드의 미적용 초안을 현재 페이지에 적용한 뒤 발행합니다.',
        confirmLabel: '적용 후 발행',
        onConfirm: () => {
          if (!isPageOperationTargetActive(confirmationTarget, latestPageRef.current || page)) return;
          // Keep the existing serialized style save/replay path for style-only
          // confirms; code drafts use the unified page materialization path.
          if (!pendingRef.current.hasPendingCode && pendingRef.current.hasPendingStyle) {
            void pendingRef.current.persistStyleNow?.();
            return;
          }
          const confirmedPage = pendingRef.current.applyPendingDrafts?.();
          if (confirmedPage) void saveNow(confirmedPage, true);
        },
      });
      return { ok: false, reason: 'draft-confirm-required' };
    }

    markSaveStatus('warning', '발행 중', '변경 내용을 서버에 저장하고 있습니다.', { phase: 'publishing' });

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
    const saveStartedAt = Date.now();
    let result = null;
    try {
      if (saveMode === 'update-existing') {
        result = await persistPage(nextPage, authUser, { tab, expectedUpdatedAt, saveMode: 'update-existing', verifyPublic: false });
      } else {
        result = await persistPage(nextPage, authUser, { tab, expectedUpdatedAt, expectedRevision, saveMode: 'create-new', verifyPublic: false });
      }
    } catch (error) {
      if (!targetIsActive()) {
        // Preserve A's own request snapshot, never the currently visible B.
        const recovery = preserveInactiveFailedSaveDraft({
          page: nextPage,
          authUser,
          saveStartedAt,
        });
        showToast(
          recovery.ok
            ? '이전 페이지 저장 실패 · 편집 내용은 임시 보관했습니다.'
            : '이전 페이지 저장 실패 · 임시 보관 실패, 화면을 닫지 마세요.',
          recovery.ok ? 'warning' : 'error',
        );
        return { ok: false, error, reason: 'inactive-page', page: activePage(), recoveryDraftSaved: recovery.ok };
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

    try {
      assertValidPageSaveResult({
        result,
        requestPage: result?.clientPage || nextPage,
        saveMode,
        expectedRevision,
        requireSaveRequestId: !result?.replayReason,
      });
    } catch (error) {
      if (!targetIsActive()) {
        // Preserve A's own request snapshot, never the currently visible B.
        const recovery = preserveInactiveFailedSaveDraft({
          page: nextPage,
          authUser,
          saveStartedAt,
        });
        showToast(
          recovery.ok
            ? '이전 페이지 저장 실패 · 편집 내용은 임시 보관했습니다.'
            : '이전 페이지 저장 실패 · 임시 보관 실패, 화면을 닫지 마세요.',
          recovery.ok ? 'warning' : 'error',
        );
        return { ok: false, error, reason: 'inactive-page', page: activePage(), recoveryDraftSaved: recovery.ok };
      }
      await handlePagePersistError({
        error,
        page: nextPage,
        recoveryPage: activePage(),
        authUser,
        handlePageSaveError,
        markSaveStatus,
        showToast,
      });
      return { ok: false, error, reason: 'invalid-save-result' };
    }

    result = attachPublicPageSaveVerification(result);

    if (!targetIsActive()) {
      const persistedClientPage = result?.clientPage || nextPage;
      const savedTargetPage = result?.page ? savedPageFromResult(persistedClientPage, result.page) : persistedClientPage;
      const verificationPending = settlePendingPublicVerification({
        result,
        savedPage: savedTargetPage,
        draftPages: [nextPage, savedTargetPage],
        scope: 'page',
        authUser,
        latestPageRef,
        markSaveStatus,
        showToast,
        surfaceStatus: false,
      });
      if (!verificationPending) {
        clearPageDraft({ page: nextPage, authUser });
        clearPageDraft({ page: savedTargetPage, authUser });
      }
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
        message: '저장 중 변경된 내용을 자동으로 이어서 저장합니다.',
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
      showToast,
    });
    return { ok: true, page: savedPage, result };
  }

  return { saveNow };
}
