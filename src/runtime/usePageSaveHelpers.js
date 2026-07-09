import {
  pageForAccountSave as prepareAccountSavePage,
  savedPageFromResult,
} from './savePageIdentity.js';

export function usePageSaveHelpers({
  page,
  authUser,
  latestPageRef,
  normalizeFreeEmailIntegrations,
}) {
  const pageForAccountSave = (sourcePage = null) => prepareAccountSavePage({
    sourcePage,
    currentPage: page,
    latestPage: latestPageRef.current,
    authUser,
    normalizeFreeEmailIntegrations,
  });

  return {
    pageForAccountSave,
    savedPageFromResult,
  };
}
