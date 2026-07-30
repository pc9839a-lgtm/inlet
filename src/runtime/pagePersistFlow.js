import { STORAGE_KEY } from '../config/storageKeys.js';
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
