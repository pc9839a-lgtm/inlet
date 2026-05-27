import { isServerPageMode, runtimeConfig } from '../config/runtimeConfig.js';
import { apiFetch, postJson, projectAuthHeaders } from './apiClient.js';
import { projectContext } from './projectContext.js';

export function managerInviteUrl(token = '') {
  const safeToken = encodeURIComponent(String(token || '').trim());
  if (!safeToken) return '';
  const base = typeof location !== 'undefined' ? location.origin : runtimeConfig.apiBaseUrl;
  return `${base}/invite/${safeToken}`;
}

export function createLocalManagerInvite(page = {}, manager = {}) {
  const tokenSeed = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const token = `local-${String(page.projectId || page.slug || 'project')}-${tokenSeed}`.replace(/[^a-zA-Z0-9-_]/g, '-');
  return {
    token,
    status: 'pending',
    managerEmail: manager.email || '',
    managerName: manager.name || '',
    invitedAt: new Date().toISOString(),
  };
}

export async function createServerManagerInvite(page, authUser, manager) {
  if (!isServerPageMode()) {
    throw new Error('서버 페이지 모드에서만 실제 초대 링크를 발급할 수 있습니다.');
  }

  const context = projectContext(page, authUser);
  const data = await postJson('/api/projects/invites', {
    project: context,
    manager,
  }, {
    headers: projectAuthHeaders(context),
  });
  return data?.invite || null;
}

export async function fetchServerManagerInvite(token) {
  const safeToken = encodeURIComponent(String(token || '').trim());
  if (!safeToken) return null;
  const res = await apiFetch(`/api/projects/invites/${safeToken}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`초대 정보를 불러오지 못했습니다. ${res.status}`);
  const data = await res.json();
  return data?.invite || null;
}

export async function acceptServerManagerInvite(token, input = {}) {
  const safeToken = encodeURIComponent(String(token || '').trim());
  if (!safeToken) throw new Error('초대 토큰이 없습니다.');
  return postJson(`/api/projects/invites/${safeToken}/accept`, input);
}
