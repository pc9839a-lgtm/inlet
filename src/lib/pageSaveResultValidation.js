import { ApiError } from './apiClient.js';

const INVALID_SAVE_RESULT_CODE = 'PAGE_SAVE_RESULT_INVALID';

function text(value) {
  return String(value || '').trim();
}

function revision(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
}

function invalidSaveResult(reason, details = {}) {
  return new ApiError(
    '서버 저장 응답을 확인하지 못했습니다. 저장 완료로 처리하지 않고 작업을 임시 보관했습니다. 다시 저장해주세요.',
    500,
    {
      code: INVALID_SAVE_RESULT_CODE,
      reason,
      retryable: false,
      ...details,
    },
  );
}

export function assertValidPageSaveResult({
  result,
  requestPage = {},
  saveMode = '',
  expectedRevision,
  expectedSaveRequestId = '',
} = {}) {
  if (result?.mode === 'local') return result;

  if (!result || result.ok !== true) {
    throw invalidSaveResult('response-not-ok');
  }

  const savedPage = result.page;
  if (!savedPage || typeof savedPage !== 'object' || Array.isArray(savedPage)) {
    throw invalidSaveResult('missing-page');
  }

  const expectedPageId = text(requestPage.id || requestPage.pageId);
  const actualPageId = text(savedPage.id || savedPage.pageId);
  if (!actualPageId || (expectedPageId && actualPageId !== expectedPageId)) {
    throw invalidSaveResult('page-id-mismatch', {
      expectedPageId,
      actualPageId,
    });
  }

  const expectedProjectId = text(requestPage.projectId);
  const actualProjectId = text(savedPage.projectId);
  if (!actualProjectId || (expectedProjectId && actualProjectId !== expectedProjectId)) {
    throw invalidSaveResult('project-id-mismatch', {
      expectedProjectId,
      actualProjectId,
    });
  }

  const expectedSlug = text(requestPage.slug);
  const actualSlug = text(savedPage.slug);
  if (!actualSlug || (expectedSlug && actualSlug !== expectedSlug)) {
    throw invalidSaveResult('slug-mismatch', {
      expectedSlug,
      actualSlug,
    });
  }

  const requestedMode = text(saveMode);
  const responseMode = text(result.saveMode);
  if (responseMode && requestedMode && responseMode !== requestedMode) {
    throw invalidSaveResult('save-mode-mismatch', {
      expectedSaveMode: requestedMode,
      actualSaveMode: responseMode,
    });
  }

  const expectedRequestId = text(expectedSaveRequestId);
  const actualRequestId = text(result.saveRequestId);
  if (expectedRequestId && actualRequestId !== expectedRequestId) {
    throw invalidSaveResult('save-request-id-mismatch', {
      expectedSaveRequestId: expectedRequestId,
      actualSaveRequestId: actualRequestId,
    });
  }

  const beforeRevision = revision(expectedRevision ?? requestPage.revision ?? 0);
  const savedRevision = revision(savedPage.revision);
  if (savedRevision <= 0) {
    throw invalidSaveResult('invalid-revision', {
      expectedRevision: Math.max(0, beforeRevision),
      actualRevision: savedRevision,
    });
  }
  if (beforeRevision >= 0 && savedRevision <= beforeRevision) {
    throw invalidSaveResult('revision-not-advanced', {
      expectedRevision: beforeRevision,
      actualRevision: savedRevision,
    });
  }

  const savedUpdatedAt = text(savedPage.updatedAt || savedPage.savedAt);
  if (!savedUpdatedAt) {
    throw invalidSaveResult('missing-save-timestamp', {
      actualRevision: savedRevision,
    });
  }

  return result;
}

export { INVALID_SAVE_RESULT_CODE };
