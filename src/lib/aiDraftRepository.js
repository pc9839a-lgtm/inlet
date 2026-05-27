import { isServerAiMode } from '../config/runtimeConfig.js';
import { apiFetch, postJson, projectAuthHeaders } from './apiClient.js';
import { projectContext } from './projectContext.js';

export async function fetchServerAiDrafts(page, authUser = null) {
  if (!isServerAiMode()) return null;

  const context = projectContext(page, authUser);
  const params = new URLSearchParams({
    projectId: context.projectId,
    ownerId: context.ownerId,
    slug: context.slug,
  });
  const res = await apiFetch(`/api/ai/drafts?${params.toString()}`, {
    headers: projectAuthHeaders(context),
  });
  if (!res.ok) throw new Error(`AI 초안 목록 불러오기 실패: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.drafts) ? data.drafts : [];
}

export async function saveServerAiDraft(item, page, authUser = null) {
  if (!isServerAiMode()) return null;

  const context = projectContext(page, authUser);
  const data = await postJson('/api/ai/drafts', {
    draft: item,
    project: context,
  }, { headers: projectAuthHeaders(context) });
  return data?.draft || null;
}

export async function deleteServerAiDraft(id, page, authUser = null) {
  if (!isServerAiMode()) return null;

  const context = projectContext(page, authUser);
  const params = new URLSearchParams({
    projectId: context.projectId,
    ownerId: context.ownerId,
  });
  const res = await apiFetch(`/api/ai/drafts/${encodeURIComponent(id)}?${params.toString()}`, {
    method: 'DELETE',
    headers: projectAuthHeaders(context),
  });
  if (!res.ok) throw new Error(`AI 초안 삭제 실패: ${res.status}`);
  return res.json();
}
