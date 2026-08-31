import { STORAGE_KEY } from '../config/storageKeys.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import { clearPageDraft } from './pageDraftStore.js';
import { PAGE_SAVE_LABEL, pageSaveErrorFeedback, pageSaveSuccessFeedback } from './pageSaveFeedback.js';

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
  latestPageRef,
  saveLocalJson,
  setPage,
  setSaved,
  markSaveStatus,
  message = '저장 중 추가로 수정한 내용이 있습니다. 현재 화면은 한 번 더 저장해주세요.',
}) {
  const rebasedPage = rebaseSavedPageIdentity(currentPage, result?.page);
  latestPageRef.current = rebasedPage;
  setPage(rebasedPage);
  saveLocalJson(STORAGE_KEY, rebasedPage, PAGE_SAVE_LABEL);
  setSaved(false);
  markSaveStatus('warning', '서버 저장 완료', message);
  return rebasedPage;
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
  latestPageRef.current = savedPage;
  setPage(savedPage);
  saveLocalJson(STORAGE_KEY, savedPage, PAGE_SAVE_LABEL);
  clearPageDraft({ page: nextPage });
  clearPageDraft({ page: savedPage });
  setSaved(true);
  setTimeout(() => setSaved(false), 1000);
  const feedback = pageSaveSuccessFeedback(result, scope);
  markSaveStatus(feedback.level, feedback.title, feedback.message);
  return savedPage;
}
