import { STORAGE_KEY } from '../config/storageKeys.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import { optimizePageForServerSave } from '../lib/pageSaveOptimizer.js';
import {
  clearPageDraft,
  pageDraftContentSignature,
  pageDraftIdentity,
  pageDraftStorageFailureMessage,
  readPageDraft,
  savePageDraftResult,
} from './pageDraftStore.js';
import {
  PAGE_SAVE_LABEL,
  pageSaveErrorFeedback,
  pageSavePublicVerificationPending,
  pageSaveSuccessFeedback,
} from './pageSaveFeedback.js';
import { setWorkspaceUnsavedDirty } from './workspaceUnsavedGuard.js';

function preserveRecoveryDraft(page, authUser) {
  if (!page) {
    return {
      ok: false,
      reason: 'unavailable',
      error: new Error('recovery page is missing'),
      draft: null,
    };
  }
  return savePageDraftResult({
    page,
    authUser,
    interactionConfirmed: true,
  });
}

async function compactRecoveryPage(page) {
  if (!page) return page;
  try {
    return await optimizePageForServerSave(page);
  } catch {
    // A recovery attempt must never replace the latest edit with a partial object.
    // If compaction itself cannot complete, preserve the original page and let
    // pageDraftStore report the real browser storage failure.
    return page;
  }
}

function sameDraftIdentity(left, right, authUser) {
  if (!left || !right) return false;
  return pageDraftIdentity(left, authUser) === pageDraftIdentity(right, authUser);
}

function sameSavedContent(left, right) {
  if (!left || !right) return false;
  return pageDraftContentSignature(left) === pageDraftContentSignature(right);
}

function clearMatchingRecoveryDraft(candidatePage, savedPage, authUser) {
  if (!candidatePage || !savedPage) return false;
  const draft = readPageDraft({ page: candidatePage, authUser });
  if (!draft?.page) return true;
  if (!sameSavedContent(draft.page, savedPage)) return false;
  return clearPageDraft({ page: candidatePage, authUser });
}

function savedVersionIsStillActive(savedPage, latestPageRef, authUser) {
  const activePage = latestPageRef?.current;
  if (!activePage) return true;
  if (!sameDraftIdentity(activePage, savedPage, authUser)) return false;
  return sameSavedContent(activePage, savedPage);
}

export async function handlePagePersistError({
  error,
  page,
  recoveryPage = page,
  authUser,
  handlePageSaveError,
  markSaveStatus,
  showToast,
}) {
  recoveryPage = await compactRecoveryPage(recoveryPage);
  const recoveryResult = preserveRecoveryDraft(recoveryPage, authUser);
  setWorkspaceUnsavedDirty(true);
  const handled = await handlePageSaveError(error, page);
  const feedback = pageSaveErrorFeedback(error, handled, {
    saved: recoveryResult.ok,
    message: recoveryResult.ok ? '' : pageDraftStorageFailureMessage(recoveryResult),
  });
  markSaveStatus(feedback.level, feedback.title, feedback.message);
  if (feedback.toast) showToast(feedback.toast, feedback.level);
  return {
    handled,
    feedback,
    recoveryDraftSaved: recoveryResult.ok,
    recoveryDraftFailureReason: recoveryResult.ok ? '' : recoveryResult.reason,
  };
}

export function rebaseSavedPageIdentity(currentPage = {}, serverPage = null) {
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

export function commitPendingLocalChangesAfterSave({
  result,
  currentPage,
  recoveryPage = currentPage,
  authUser,
  latestPageRef,
  saveLocalJson,
  setPage,
  setSaved,
  markSaveStatus,
  message = '추가 수정이 있습니다. 한 번 더 저장해주세요.',
}) {
  const rebasedPage = rebaseSavedPageIdentity(currentPage, result?.page);
  const rebasedRecoveryPage = rebaseSavedPageIdentity(recoveryPage, result?.page);
  const recoveryResult = preserveRecoveryDraft(rebasedRecoveryPage, authUser);

  if (recoveryResult.ok) {
    const rebasedIdentity = pageDraftIdentity(rebasedRecoveryPage, authUser);
    if (pageDraftIdentity(currentPage, authUser) !== rebasedIdentity) {
      clearPageDraft({ page: currentPage, authUser });
    }
    if (recoveryPage !== currentPage && pageDraftIdentity(recoveryPage, authUser) !== rebasedIdentity) {
      clearPageDraft({ page: recoveryPage, authUser });
    }
  }

  latestPageRef.current = rebasedPage;
  setPage(rebasedPage);
  saveLocalJson(STORAGE_KEY, rebasedPage, PAGE_SAVE_LABEL, { quietSuccess: true });
  setSaved(false);
  setWorkspaceUnsavedDirty(true);

  if (recoveryResult.ok) {
    markSaveStatus('warning', '추가 수정 있음', message);
  } else {
    markSaveStatus(
      'error',
      '추가 수정 · 임시 보관 실패',
      `${message} ${pageDraftStorageFailureMessage(recoveryResult)}`,
    );
  }
  return rebasedPage;
}

export function settlePendingPublicVerification({
  result,
  savedPage,
  draftPages = [],
  scope = 'page',
  authUser,
  latestPageRef = null,
  markSaveStatus = () => {},
  showToast = () => {},
  successToast = '',
  surfaceStatus = true,
} = {}) {
  const verification = result?.publicVerification;
  if (!verification?.pending || typeof verification?.completion?.then !== 'function') return false;

  const handleSettledVerification = (status = {}) => {
    if (status?.superseded) return status;
    const settledResult = { ...result, publicVerification: status };
    const activeSavedVersion = savedVersionIsStillActive(savedPage, latestPageRef, authUser);

    if (status?.ok === true) {
      const candidates = [...draftPages, savedPage].filter(Boolean);
      for (const candidate of candidates) {
        clearMatchingRecoveryDraft(candidate, savedPage, authUser);
      }
      if (surfaceStatus && activeSavedVersion) {
        setWorkspaceUnsavedDirty(false);
        const feedback = pageSaveSuccessFeedback(settledResult, scope);
        markSaveStatus(feedback.level, feedback.title, feedback.message);
        if (successToast) showToast(successToast, 'success');
      }
      return status;
    }

    if (surfaceStatus && activeSavedVersion) {
      setWorkspaceUnsavedDirty(true);
      const feedback = pageSaveSuccessFeedback(settledResult, scope);
      markSaveStatus(feedback.level, feedback.title, feedback.message);
      if (feedback.toast) showToast(feedback.toast, feedback.level);
    }
    return status;
  };

  verification.completion
    .then(handleSettledVerification)
    .catch((error) => handleSettledVerification({
      ok: false,
      pending: false,
      errorCode: 'PAGE_PUBLIC_VERIFY_FAILED',
      message: String(error?.message || '공개 페이지 반영을 확인하지 못했습니다.'),
    }));
  return true;
}

export function commitSavedPageResult({
  result,
  nextPage,
  scope = 'page',
  authUser,
  latestPageRef,
  savedPageFromResult,
  saveLocalJson,
  setPage,
  setSaved,
  markSaveStatus,
  showToast = () => {},
  successToast = '',
}) {
  const persistedClientPage = result?.clientPage || nextPage;
  const savedPage = result?.page ? savedPageFromResult(persistedClientPage, result.page) : persistedClientPage;
  const verificationPending = pageSavePublicVerificationPending(result);
  latestPageRef.current = savedPage;
  setPage(savedPage);
  saveLocalJson(STORAGE_KEY, savedPage, PAGE_SAVE_LABEL, { quietSuccess: true });

  if (!verificationPending) {
    clearPageDraft({ page: nextPage, authUser });
    clearPageDraft({ page: savedPage, authUser });
  }

  setWorkspaceUnsavedDirty(verificationPending);
  setSaved(true);
  setTimeout(() => setSaved(false), 1000);
  const feedback = pageSaveSuccessFeedback(result, scope);
  markSaveStatus(feedback.level, feedback.title, feedback.message);

  if (verificationPending) {
    settlePendingPublicVerification({
      result,
      savedPage,
      draftPages: [nextPage, savedPage],
      scope,
      authUser,
      latestPageRef,
      markSaveStatus,
      showToast,
      successToast,
      surfaceStatus: true,
    });
  } else if (successToast) {
    showToast(successToast, 'success');
  }

  return savedPage;
}
