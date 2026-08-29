import { STORAGE_KEY } from '../config/storageKeys.js';
import { clearPageDraft } from './pageDraftStore.js';
import { PAGE_SAVE_LABEL, pageSaveErrorFeedback, pageSavePublicVerificationDelayed, pageSaveSuccessFeedback } from './pageSaveFeedback.js';

export async function handlePagePersistError({
  error,
  page,
  handlePageSaveError,
  markSaveStatus,
  showToast,
}) {
  const handled = await handlePageSaveError(error, page);
  const feedback = pageSaveErrorFeedback(error, handled);
  markSaveStatus(feedback.level, feedback.title, feedback.message);
  if (feedback.toast) showToast(feedback.toast, feedback.level);
  return { handled, feedback };
}

export function shouldPreservePageDraftAfterSave(result) {
  return pageSavePublicVerificationDelayed(result);
}

function savedVersionMetadata(serverPage = {}) {
  return {
    id: serverPage.id,
    projectId: serverPage.projectId,
    ownerId: serverPage.ownerId,
    revision: serverPage.revision,
    createdAt: serverPage.createdAt,
    updatedAt: serverPage.updatedAt,
    savedAt: serverPage.savedAt,
    publishedAt: serverPage.publishedAt,
  };
}

export function commitSavedVersionIntoNewerDraft({
  result,
  currentPage,
  latestPageRef,
  savedPageFromResult,
  saveLocalJson,
  setPage,
  markSaveStatus,
}) {
  const nextDraft = result?.page
    ? savedPageFromResult(currentPage, savedVersionMetadata(result.page))
    : currentPage;
  latestPageRef.current = nextDraft;
  setPage(nextDraft);
  saveLocalJson(STORAGE_KEY, nextDraft, PAGE_SAVE_LABEL);
  const verificationDelayed = shouldPreservePageDraftAfterSave(result);
  markSaveStatus(
    'warning',
    '서버 저장됨 · 추가 변경 있음',
    verificationDelayed
      ? '이전 내용은 서버에 기록됐지만 공개 반영 확인이 지연됐고, 저장 중 추가한 변경은 아직 서버에 저장되지 않았습니다.'
      : '저장 요청 이후 변경한 내용은 아직 서버에 저장되지 않았습니다.',
  );
  return nextDraft;
}

export function commitSavedPageResult({
  result,
  nextPage,
  scope = 'page',
  latestPageRef,
  savedPageFromResult,
  saveLocalJson,
  setPage,
  setSaved,
  markSaveStatus,
}) {
  const persistedClientPage = result?.clientPage || nextPage;
  const savedPage = result?.page ? savedPageFromResult(persistedClientPage, result.page) : persistedClientPage;
  const preserveRecoveryDraft = shouldPreservePageDraftAfterSave(result);
  latestPageRef.current = savedPage;
  setPage(savedPage);
  saveLocalJson(STORAGE_KEY, savedPage, PAGE_SAVE_LABEL);
  if (!preserveRecoveryDraft) {
    clearPageDraft({ page: nextPage });
    clearPageDraft({ page: savedPage });
  }
  setSaved(true);
  setTimeout(() => setSaved(false), 1000);
  const feedback = pageSaveSuccessFeedback(result, scope);
  markSaveStatus(feedback.level, feedback.title, feedback.message);
  return savedPage;
}
