export const PAGE_SAVE_TIMEOUT_MS = 15_000;
export const PAGE_SAVE_MAX_ATTEMPTS = 2;
export const PAGE_SAVE_RETRY_DELAY_MS = 350;

const RETRYABLE_PAGE_SAVE_STATUSES = new Set([408, 425, 500, 502, 503, 504]);

export function isPageroPageSaveRequest(path = '', payload = null) {
  const requestPath = String(path || '');
  const saveMode = String(payload?.saveMode || '').trim();
  return /^\/api\/pages\/[^/?]+(?:\?|$)/.test(requestPath)
    && ['create-new', 'update-existing'].includes(saveMode)
    && !!payload?.page
    && typeof payload.page === 'object'
    && !!payload?.identity
    && typeof payload.identity === 'object';
}

export function isRetryablePageSaveStatus(status = 0) {
  return RETRYABLE_PAGE_SAVE_STATUSES.has(Number(status || 0));
}

export function isRetryablePageSaveFailure(error = null) {
  return error?.details?.scope === 'page-save' && error?.details?.retryable === true;
}

export function pageSaveFailureKind(error = null) {
  const code = String(error?.details?.code || '').trim();
  if (code === 'PAGE_SAVE_TIMEOUT') return 'timeout';
  if (code === 'PAGE_SAVE_NETWORK_ERROR') return 'network';
  if (code === 'PAGE_SAVE_TRANSIENT_SERVER') return 'server';
  return isRetryablePageSaveFailure(error) ? 'transient' : '';
}
