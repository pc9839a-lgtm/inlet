import { ApiError, postJson, projectAuthHeaders } from './apiClient.js';
import { projectContext } from './projectContext.js';

function domainContext(page = {}, authUser = null) {
  const context = projectContext(page, authUser);
  const pageId = String(page?.id || '').trim();
  if (!authUser?.session) {
    throw new ApiError('로그인이 필요합니다.', 401, { code: 'AUTH_SIGNED_SESSION_REQUIRED' });
  }
  if (!context.projectId || !pageId) {
    throw new ApiError('페이지를 먼저 저장한 뒤 개인 도메인을 연결해주세요.', 409, {
      code: 'DOMAIN_PAGE_IDENTITY_REQUIRED',
    });
  }
  return { context, pageId };
}

function requestPayload(page = {}, authUser = null, extra = {}) {
  const { context, pageId } = domainContext(page, authUser);
  return {
    context,
    payload: {
      project: {
        projectId: context.projectId,
        slug: context.slug,
      },
      pageId,
      ...extra,
    },
  };
}

export async function checkPageDomain(page = {}, authUser = null, hostname = '') {
  const { context, payload } = requestPayload(page, authUser, { hostname: String(hostname || '').trim() });
  return postJson('/api/domains/check', payload, {
    headers: projectAuthHeaders(context),
  });
}

export async function verifyPageDomain(page = {}, authUser = null, hostname = '') {
  const { context, payload } = requestPayload(page, authUser, {
    action: 'verify',
    hostname: String(hostname || '').trim(),
  });
  return postJson('/api/domains/manage', payload, {
    headers: projectAuthHeaders(context),
  });
}

export async function detachPageDomain(page = {}, authUser = null) {
  const { context, payload } = requestPayload(page, authUser, { action: 'detach' });
  return postJson('/api/domains/manage', payload, {
    headers: projectAuthHeaders(context),
  });
}

export function domainOperationMessage(error, fallback = '도메인 작업을 완료하지 못했습니다.') {
  const code = String(error?.details?.code || error?.details?.errorCode || error?.code || '').trim();
  if (code === 'DOMAIN_ALREADY_CONNECTED') return '이미 다른 페이지에서 사용 중인 도메인입니다.';
  if (code === 'DOMAIN_PAGE_IDENTITY_REQUIRED') return '페이지를 먼저 저장한 뒤 개인 도메인을 연결해주세요.';
  if (code === 'DOMAIN_CONNECTION_NOT_FOUND') return '페이지 저장을 먼저 완료한 뒤 상태를 확인해주세요.';
  if (code === 'DOMAIN_PROVIDER_CLEANUP_REQUIRED') return '기존 도메인 연결을 안전하게 해제할 수 없습니다. 운영 설정을 확인해주세요.';
  if (code === 'DOMAIN_PROJECT_MISMATCH' || code === 'DOMAIN_HOSTNAME_MISMATCH') return '현재 페이지와 서버의 도메인 정보가 일치하지 않습니다. 새로고침 후 다시 확인해주세요.';
  if (code === 'DOMAIN_ALREADY_DISCONNECTED') return '이미 해제된 도메인입니다.';
  return String(error?.message || fallback);
}
