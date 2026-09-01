import { fetchServerPage } from '../lib/pageRepository.js';
import { projectContext } from '../lib/projectContext.js';
import { pageDraftContentSignature } from './pageDraftStore.js';

function pageSaveErrorCode(error = null) {
  return String(error?.details?.code || error?.details?.errorCode || error?.code || '').trim();
}

export function isCommittedSaveRetryConflict(error = null) {
  return Number(error?.status || 0) === 409 && pageSaveErrorCode(error) === 'PAGE_REVISION_CONFLICT';
}

export function sameCommittedPageContent(serverPage = null, clientPage = null) {
  if (!serverPage || !clientPage) return false;
  return pageDraftContentSignature(serverPage) === pageDraftContentSignature(clientPage);
}

export async function recoverCommittedPageSave({ error, page, authUser } = {}) {
  if (!isCommittedSaveRetryConflict(error) || !page) return null;

  let serverPage = null;
  try {
    serverPage = await fetchServerPage(page.slug, projectContext(page, authUser));
  } catch (lookupError) {
    console.warn('Committed save retry lookup failed:', lookupError);
    return null;
  }

  if (!sameCommittedPageContent(serverPage, page)) return null;

  return {
    ok: true,
    replayed: true,
    replayReason: 'same-content-after-revision-conflict',
    page: serverPage,
    clientPage: page,
    publicVerification: {
      ok: true,
      skipped: true,
      pending: false,
      reason: 'already-committed',
    },
  };
}
