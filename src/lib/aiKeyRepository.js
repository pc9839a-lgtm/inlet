import { isServerAiMode } from '../config/runtimeConfig.js';
import { apiFetch, postJson, projectAuthHeaders } from './apiClient.js';
import { projectContext } from './projectContext.js';

export async function fetchServerAiKeyStatus(page, authUser = null) {
  if (!isServerAiMode()) return null;
  const context = projectContext(page, authUser);
  const params = new URLSearchParams({
    projectId: context.projectId,
    ownerId: context.ownerId,
    slug: context.slug,
  });
  const res = await apiFetch(`/api/ai/key?${params.toString()}`, {
    headers: projectAuthHeaders(context),
  });
  if (!res.ok) throw new Error(`AI API 키 상태 확인 실패: ${res.status}`);
  const data = await res.json();
  return data?.key || null;
}

export async function saveServerAiKey(apiKey, page, authUser = null) {
  if (!isServerAiMode()) return null;
  const context = projectContext(page, authUser);
  const data = await postJson('/api/ai/key', {
    projectId: context.projectId,
    ownerId: context.ownerId,
    slug: context.slug,
    apiKey,
  }, { method: 'PUT', headers: projectAuthHeaders(context) });
  return data?.key || null;
}

export async function deleteServerAiKey(page, authUser = null) {
  if (!isServerAiMode()) return null;
  const context = projectContext(page, authUser);
  const params = new URLSearchParams({
    projectId: context.projectId,
    ownerId: context.ownerId,
    slug: context.slug,
  });
  const res = await apiFetch(`/api/ai/key?${params.toString()}`, {
    method: 'DELETE',
    headers: projectAuthHeaders(context),
  });
  if (!res.ok) throw new Error(`AI API 키 삭제 실패: ${res.status}`);
  const data = await res.json();
  return data?.key || null;
}

export function serverAiKeyLabel(status = null) {
  if (!status || status.status === 'missing') return '저장된 서버 키 없음';
  if (status.connected) return `저장됨: ${status.maskedKey || 'sk-...'}`;
  return status.status || '확인 필요';
}
