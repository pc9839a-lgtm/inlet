import { readFile } from 'node:fs/promises';
import { ApiError, postJson } from '../src/lib/apiClient.js';
import {
  PAGE_SAVE_MAX_ATTEMPTS,
  PAGE_SAVE_RETRY_DELAY_MS,
  PAGE_SAVE_TIMEOUT_MS,
  isPageroPageSaveRequest,
  isRetryablePageSaveFailure,
  isRetryablePageSaveStatus,
  pageSaveFailureKind,
} from '../src/lib/pageSaveTransportPolicy.js';
import { pageSaveErrorFeedback } from '../src/runtime/pageSaveFeedback.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const savePayload = {
  saveMode: 'update-existing',
  saveRequestId: 'update-existing:project-qa:page-qa:qa-page:4',
  identity: {
    mode: 'update-existing',
    pageId: 'page-qa',
    projectId: 'project-qa',
    revision: 4,
    slug: 'qa-page',
  },
  page: {
    id: 'page-qa',
    projectId: 'project-qa',
    revision: 4,
    slug: 'qa-page',
    title: 'network recovery qa',
  },
};

assert(PAGE_SAVE_TIMEOUT_MS === 15_000, 'page saves must have a bounded 15 second transport timeout');
assert(PAGE_SAVE_MAX_ATTEMPTS === 2, 'page saves must retry at most once');
assert(PAGE_SAVE_RETRY_DELAY_MS >= 250 && PAGE_SAVE_RETRY_DELAY_MS <= 1000, 'page save retry delay must stay short and bounded');
assert(isPageroPageSaveRequest('/api/pages/qa-page?saveMode=update-existing', savePayload), 'normal page saves must enter transport recovery');
assert(!isPageroPageSaveRequest('/api/pages/qa-page/restore', savePayload), 'revision restore requests must not inherit page-save retries');
assert(!isPageroPageSaveRequest('/api/auth/login', savePayload), 'non-page APIs must not inherit page-save retries');
assert(isRetryablePageSaveStatus(408) && isRetryablePageSaveStatus(500) && isRetryablePageSaveStatus(502) && isRetryablePageSaveStatus(503) && isRetryablePageSaveStatus(504), 'temporary server and timeout statuses must be retryable');
assert(!isRetryablePageSaveStatus(401) && !isRetryablePageSaveStatus(403) && !isRetryablePageSaveStatus(409) && !isRetryablePageSaveStatus(422), 'auth, permission, conflict, and validation failures must never auto-retry');

const originalFetch = globalThis.fetch;
try {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ ok: false, message: 'temporary unavailable' }), { status: 503 });
    return new Response(JSON.stringify({ ok: true, page: { ...savePayload.page, revision: 5 } }), { status: 200 });
  };
  const recovered = await postJson('/api/pages/qa-page?saveMode=update-existing', savePayload);
  assert(calls === 2 && recovered?.ok === true && recovered?.page?.revision === 5, 'a transient server failure must retry once with the same save request');

  calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ ok: false, code: 'PAGE_REVISION_CONFLICT', message: 'Page revision conflict' }), { status: 409 });
  };
  let conflict = null;
  try {
    await postJson('/api/pages/qa-page?saveMode=update-existing', savePayload);
  } catch (error) {
    conflict = error;
  }
  assert(calls === 1 && conflict instanceof ApiError && conflict.status === 409, 'revision conflicts must bypass automatic transport retries');

  calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError('Failed to fetch');
  };
  let networkError = null;
  try {
    await postJson('/api/pages/qa-page?saveMode=update-existing', savePayload);
  } catch (error) {
    networkError = error;
  }
  assert(calls === 2, 'network failures must receive exactly one automatic retry');
  assert(networkError instanceof ApiError && networkError.status === 0, 'network failures must become a stable ApiError contract');
  assert(isRetryablePageSaveFailure(networkError) && pageSaveFailureKind(networkError) === 'network', 'network failure must be explicitly marked retryable for save UX');
  assert(networkError.details?.attempt === 2 && networkError.details?.maxAttempts === 2, 'final network failure must expose bounded attempt metadata');

  const networkFeedback = pageSaveErrorFeedback(networkError, false, { saved: true, message: '' });
  assert(networkFeedback.title === '일시적 저장 실패' && networkFeedback.toast === '저장 실패 · 다시 저장 가능', 'retryable failures must tell the user the edit is recoverable and can be saved again');
  assert(networkFeedback.message.includes('자동 보관') && networkFeedback.message.includes('인터넷 연결'), 'network save feedback must preserve the draft and give a compact connection action');

  calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError('Failed to fetch');
  };
  let ordinaryError = null;
  try {
    await postJson('/api/auth/login', { email: 'qa@example.com' });
  } catch (error) {
    ordinaryError = error;
  }
  assert(calls === 1 && ordinaryError instanceof TypeError, 'non-page POST behavior must remain unchanged and must not auto-retry');
} finally {
  globalThis.fetch = originalFetch;
}

const apiClientSource = await readFile('src/lib/apiClient.js', 'utf8');
const repositorySource = await readFile('src/lib/pageRepository.js', 'utf8');
const feedbackSource = await readFile('src/runtime/pageSaveFeedback.js', 'utf8');

assert(apiClientSource.includes('createPageSaveAbortControl') && apiClientSource.includes('controller.abort()') && apiClientSource.includes('PAGE_SAVE_TIMEOUT_MS'), 'page save requests must be actively aborted after the bounded timeout instead of using Promise.race');
assert(apiClientSource.includes('for (let attempt = 1; attempt <= maxAttempts; attempt += 1)') && apiClientSource.includes('await sleep(PAGE_SAVE_RETRY_DELAY_MS)'), 'page save transport retry must be finite and delayed');
assert(repositorySource.includes('saveRequestId') && repositorySource.includes('pageSaveRequestId(identity, expectedRevision)'), 'automatic transport retry must reuse the existing deterministic save request identity');
assert(feedbackSource.includes("toast: '저장 실패 · 다시 저장 가능'") && feedbackSource.includes('isRetryablePageSaveFailure(error)'), 'save UX must distinguish temporary transport failure from permanent save failure');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-save-network-recovery',
  timeoutMs: PAGE_SAVE_TIMEOUT_MS,
  maxAttempts: PAGE_SAVE_MAX_ATTEMPTS,
  networkRetry: true,
  transientServerRetry: true,
  conflictRetryBlocked: true,
  nonPageBehaviorPreserved: true,
  recoveryFeedback: true,
}, null, 2));
