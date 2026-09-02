import { runtimeApiUrl, runtimeConfig } from '../config/runtimeConfig.js';
import {
  PAGE_SAVE_MAX_ATTEMPTS,
  PAGE_SAVE_RETRY_DELAY_MS,
  PAGE_SAVE_TIMEOUT_MS,
  isPageroPageSaveRequest,
  isRetryablePageSaveStatus,
} from './pageSaveTransportPolicy.js';

export class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function apiHeaders(headers = {}) {
  const next = { ...(headers || {}) };
  if (runtimeApiToken() && !next.Authorization && !next.authorization) {
    next.Authorization = `Bearer ${runtimeApiToken()}`;
  }
  if (runtimeApiToken() && !next['X-Inlet-Api-Token'] && !next['x-inlet-api-token']) {
    next['X-Inlet-Api-Token'] = runtimeApiToken();
  }
  return next;
}

export function projectAuthHeaders(context = {}, headers = {}) {
  const next = { ...(headers || {}) };
  if (context?.ownerId && !next['X-Inlet-Owner-Id'] && !next['x-inlet-owner-id']) {
    next['X-Inlet-Owner-Id'] = context.ownerId;
  }
  if (context?.projectId && !next['X-Inlet-Project-Id'] && !next['x-inlet-project-id']) {
    next['X-Inlet-Project-Id'] = context.projectId;
  }
  if (context?.session && !next['X-Inlet-Session'] && !next['x-inlet-session']) {
    next['X-Inlet-Session'] = context.session;
  }
  return next;
}

export function apiFetch(path, options = {}) {
  return fetch(runtimeApiUrl(path), {
    ...options,
    headers: apiHeaders(options.headers || {}),
  });
}

function runtimeApiToken() {
  return String(runtimeConfig.apiToken || '').trim();
}

function cleanUserFacingApiMessage(message = '', status = 0) {
  const text = String(message || '').trim();
  if (/AUTH_EMAIL_DUPLICATE|Email is already registered/i.test(text)) return '이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해주세요.';
  if (/AUTH_PHONE_DUPLICATE|Phone number is already registered/i.test(text)) return '이미 가입된 휴대폰번호입니다. 계정 정보를 확인해주세요.';
  if (/AUTH_PASSWORD_POLICY|Password must include letters and numbers/i.test(text)) return '비밀번호는 영문과 숫자를 포함해 6자리 이상으로 입력해주세요.';
  if (/EMAIL_VERIFICATION_REQUIRED|Email verification is required/i.test(text)) return '이메일 인증을 먼저 완료해주세요.';
  if (/EMAIL_VERIFICATION_INVALID|Email verification token is invalid/i.test(text)) return '인증 코드가 올바르지 않습니다. 다시 확인해주세요.';
  if (/EMAIL_VERIFICATION_EXPIRED|Email verification token has expired/i.test(text)) return '인증 코드가 만료되었습니다. 인증 메일을 다시 받아주세요.';
  if (/AUTH_LOGIN_INVALID|Email or password is invalid/i.test(text)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (/AUTH_LOGIN_REQUIRED|Email and password are required/i.test(text)) return '이메일과 비밀번호를 입력해주세요.';
  if (/AUTH_EMAIL_REQUIRED|Valid email is required/i.test(text)) return '올바른 이메일을 입력해주세요.';
  if (/AUTH_PHONE_REQUIRED|Phone number is required/i.test(text)) return '휴대폰번호를 입력해주세요.';
  if (/AUTH_ACCOUNT_NOT_FOUND|Account was not found/i.test(text)) return '계정을 찾을 수 없습니다.';
  if (/AUTH_ACCOUNT_SUSPENDED|Account is suspended/i.test(text)) return '정지된 계정입니다. 고객센터에 문의해주세요.';
  if (/AUTH_ACCOUNT_DELETED|Account is deleted/i.test(text)) return '삭제 대기 중인 계정입니다. 고객센터에 문의해주세요.';
  if (/EMAIL_SEND_|EMAIL_DOMAIN_NOT_VERIFIED/i.test(text)) return '메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.';
  if (/PAGE_SAVE_IDENTITY_REQUIRED/i.test(text)) return '기존 페이지 저장 정보가 누락되었습니다. 페이지 목록에서 다시 열어 저장해주세요.';
  if (/PAGE_SAVE_IDENTITY_MISMATCH|Existing page identity does not match/i.test(text)) return '현재 편집 화면과 서버 페이지 정보가 일치하지 않습니다. 페이지를 다시 열어주세요.';
  if (/PAGE_REVISION_CONFLICT|Page revision conflict/i.test(text)) return '다른 화면에서 먼저 저장된 내용이 있습니다. 최신 내용을 확인해주세요.';
  if (/PAGE_SLUG_CONFLICT|Page URL is already in use/i.test(text)) return '이미 사용 중인 페이지 주소입니다. 다른 주소를 입력해주세요.';
  if (/Project owner identity is required|AUTH_SESSION_MISSING|Session is invalid|Session account was not found/i.test(text)) return '로그인 세션이 없습니다. 다시 로그인한 뒤 저장해주세요.';
  if (/Project identity does not match/i.test(text)) return '현재 로그인 세션이 다른 페이지와 연결되어 있습니다. 새로고침 후 다시 저장해주세요.';
  if (/Project access is required|Project access has not been granted|Project access denied/i.test(text)) return '현재 계정에 이 페이지 접근 권한이 없습니다. 다시 로그인하거나 페이지 소유 계정을 확인해주세요.';
  if (/Project write access denied/i.test(text)) return '현재 계정에 이 페이지 저장 권한이 없습니다. 마스터 계정 또는 편집 권한을 확인해주세요.';
  if (/projectId is required/i.test(text)) return '프로젝트 정보가 누락되었습니다. 페이지를 다시 저장하거나 새로고침 후 다시 시도해주세요.';
  if (/D1 binding is not configured/i.test(text)) return '서버 데이터베이스 연결이 준비되지 않았습니다.';
  if (/Invalid JSON body/i.test(text)) return '요청 데이터 형식이 올바르지 않습니다.';
  if (/UNIQUE constraint failed: pages\.id/i.test(text)) return '페이지 저장 중 주소 충돌이 발생했습니다. 새로고침 후 다시 저장해주세요.';
  return text || `요청 실패: ${status}`;
}

function userFacingApiMessage(message = '', status = 0) {
  return cleanUserFacingApiMessage(message, status);
}

async function readApiError(res) {
  const raw = await res.text().catch(() => '');
  if (!raw) return { message: `요청 실패: ${res.status}`, details: null };

  try {
    const json = JSON.parse(raw);
    if (json?.code === 'PAGE_SLUG_CONFLICT') return { message: cleanUserFacingApiMessage('PAGE_SLUG_CONFLICT', res.status), details: json };
    const message = json?.message || json?.error?.message || json?.error || raw;
    const codedMessage = [json?.code || '', message].filter(Boolean).join(' ');
    return { message: cleanUserFacingApiMessage(codedMessage, res.status), details: json };
  } catch {
    return { message: cleanUserFacingApiMessage(raw, res.status), details: null };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPageSaveAbortControl(enabled = false, externalSignal = null) {
  if (!enabled || typeof AbortController === 'undefined') {
    return {
      signal: externalSignal || undefined,
      timedOut: () => false,
      cleanup: () => {},
    };
  }

  const controller = new AbortController();
  let timeoutTriggered = false;
  const forwardAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', forwardAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, PAGE_SAVE_TIMEOUT_MS);

  return {
    signal: controller.signal,
    timedOut: () => timeoutTriggered,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener?.('abort', forwardAbort);
    },
  };
}

function normalizePageSaveTransportError(error, { timedOut = false, attempt = 1 } = {}) {
  if (error instanceof ApiError) {
    if (!isRetryablePageSaveStatus(error.status)) return error;
    error.details = {
      ...(error.details || {}),
      code: error.details?.code || 'PAGE_SAVE_TRANSIENT_SERVER',
      scope: 'page-save',
      retryable: true,
      attempt,
      maxAttempts: PAGE_SAVE_MAX_ATTEMPTS,
    };
    return error;
  }

  const code = timedOut ? 'PAGE_SAVE_TIMEOUT' : 'PAGE_SAVE_NETWORK_ERROR';
  const message = timedOut
    ? '서버 응답 시간이 초과되었습니다.'
    : '네트워크 연결이 불안정해 저장하지 못했습니다.';
  return new ApiError(message, 0, {
    code,
    scope: 'page-save',
    retryable: true,
    transportKind: timedOut ? 'timeout' : 'network',
    attempt,
    maxAttempts: PAGE_SAVE_MAX_ATTEMPTS,
  });
}

async function postJsonAttempt(path, payload, options = {}, pageSaveRequest = false, attempt = 1) {
  const abortControl = createPageSaveAbortControl(pageSaveRequest, options.signal || null);
  try {
    const res = await apiFetch(path, {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: JSON.stringify(payload || {}),
      keepalive: !!options.keepalive,
      signal: abortControl.signal,
    });

    if (!res.ok) {
      const error = await readApiError(res);
      throw new ApiError(error.message, res.status, error.details);
    }

    const text = await res.text().catch(() => '');
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { ok: true, text };
    }
  } catch (error) {
    if (!pageSaveRequest) throw error;
    throw normalizePageSaveTransportError(error, {
      timedOut: abortControl.timedOut(),
      attempt,
    });
  } finally {
    abortControl.cleanup();
  }
}

export async function postJson(path, payload, options = {}) {
  const pageSaveRequest = isPageroPageSaveRequest(path, payload);
  const maxAttempts = pageSaveRequest ? PAGE_SAVE_MAX_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await postJsonAttempt(path, payload, options, pageSaveRequest, attempt);
    } catch (error) {
      const retryable = pageSaveRequest && error?.details?.scope === 'page-save' && error?.details?.retryable === true;
      if (!retryable || attempt >= maxAttempts) throw error;
      await sleep(PAGE_SAVE_RETRY_DELAY_MS);
    }
  }

  throw new ApiError(userFacingApiMessage('', 0), 0, {
    code: 'PAGE_SAVE_NETWORK_ERROR',
    scope: 'page-save',
    retryable: true,
  });
}
