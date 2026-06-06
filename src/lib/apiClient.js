import { runtimeApiUrl, runtimeConfig } from '../config/runtimeConfig.js';

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

function userFacingApiMessage(message = '', status = 0) {
  const text = String(message || '').trim();
  if (/PAGE_SLUG_CONFLICT|Page URL is already in use/i.test(text)) {
    return '이미 사용 중인 페이지 주소입니다. 다른 주소를 입력해주세요.';
  }
  if (/Project owner identity is required|AUTH_SESSION_MISSING|Session is invalid|Session account was not found/i.test(text)) {
    return '로그인 세션이 없습니다. 다시 로그인한 뒤 저장해주세요.';
  }
  if (/Project identity does not match/i.test(text)) {
    return '현재 로그인 세션이 다른 페이지와 연결되어 있습니다. 새로고침 후 다시 저장해주세요.';
  }
  if (/Project access is required|Project access has not been granted|Project access denied/i.test(text)) {
    return '현재 계정에 이 페이지 접근 권한이 없습니다. 다시 로그인하거나 페이지 소유 계정을 확인해주세요.';
  }
  if (/Project write access denied/i.test(text)) {
    return '현재 계정에 이 페이지 저장 권한이 없습니다. 마스터 계정 또는 편집 권한을 확인해주세요.';
  }
  if (/projectId is required/i.test(text)) {
    return '프로젝트 정보가 누락되었습니다. 페이지를 다시 저장하거나 새로고침 후 다시 시도해주세요.';
  }
  if (/D1 binding is not configured/i.test(text)) {
    return '서버 데이터베이스 연결이 준비되지 않았습니다.';
  }
  if (/Invalid JSON body/i.test(text)) {
    return '요청 데이터 형식이 올바르지 않습니다.';
  }
  if (/UNIQUE constraint failed: pages\.id/i.test(text)) {
    return '페이지 저장 중 주소 충돌이 발생했습니다. 새로고침 후 다시 저장해주세요.';
  }
  if (!text) return `요청 실패: ${status}`;
  return text;
}

async function readApiError(res) {
  const raw = await res.text().catch(() => '');
  if (!raw) return { message: `요청 실패: ${res.status}`, details: null };

  try {
    const json = JSON.parse(raw);
    if (json?.code === 'PAGE_SLUG_CONFLICT') {
      return { message: '이미 사용 중인 페이지 주소입니다. 다른 주소를 입력해주세요.', details: json };
    }
    const message = json?.message || json?.error?.message || json?.error || raw;
    return { message: userFacingApiMessage(message, res.status), details: json };
  } catch {
    return { message: userFacingApiMessage(raw, res.status), details: null };
  }
}

export async function postJson(path, payload, options = {}) {
  const res = await apiFetch(path, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: JSON.stringify(payload || {}),
    keepalive: !!options.keepalive,
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
}
