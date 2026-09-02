import { STORAGE_KEY } from '../config/storageKeys.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import {
  clearPageDraft,
  pageDraftIdentity,
  pageDraftStorageFailureMessage,
  savePageDraftResult,
} from './pageDraftStore.js';
import { PAGE_SAVE_LABEL, pageSaveErrorFeedback, pageSaveSuccessFeedback } from './pageSaveFeedback.js';

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

export async function handlePagePersistError({
  error,
  page,
  recoveryPage = page,
  authUser,
  handlePageSaveError,
  markSaveStatus,
  showToast,
}) {
  const recoveryResult = preserveRecoveryDraft(recoveryPage, authUser);
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
}) {
  const persistedClientPage = result?.clientPage || nextPage;
  const savedPage = result?.page ? savedPageFromResult(persistedClientPage, result.page) : persistedClientPage;
  latestPageRef.current = savedPage;
  setPage(savedPage);
  saveLocalJson(STORAGE_KEY, savedPage, PAGE_SAVE_LABEL, { quietSuccess: true });
  clearPageDraft({ page: nextPage, authUser });
  clearPageDraft({ page: savedPage, authUser });
  setSaved(true);
  setTimeout(() => setSaved(false), 1000);
  const feedback = pageSaveSuccessFeedback(result, scope);
  markSaveStatus(feedback.level, feedback.title, feedback.message);
  return savedPage;
}
