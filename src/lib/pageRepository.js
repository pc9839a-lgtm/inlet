import { isServerPageMode } from '../config/runtimeConfig.js';
import { ApiError, apiFetch, postJson, projectAuthHeaders } from './apiClient.js';
import { normalizePageForSave } from './pageModel.js';
import { projectContext } from './projectContext.js';

function pageSlug(pageOrSlug) {
  const raw = typeof pageOrSlug === 'string' ? pageOrSlug : pageOrSlug?.slug;
  return String(raw || 'my-page').replace(/[^a-zA-Z0-9-_]/g, '') || 'my-page';
}

function pageContextParams(context = {}) {
  const params = new URLSearchParams();
  if (context.projectId) params.set('projectId', context.projectId);
  if (context.ownerId) params.set('ownerId', context.ownerId);
  if (context.slug) params.set('slug', context.slug);
  return params;
}

async function fetchPageWithContext(safeSlug, context = {}) {
  const params = pageContextParams(context);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/pages/${encodeURIComponent(safeSlug)}${query}`, {
    headers: projectAuthHeaders(context),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`페이지 불러오기 실패: ${res.status}`);
  const data = await res.json();
  return data?.page || null;
}

export async function fetchServerPage(slug, context = {}) {
  if (!isServerPageMode()) return null;
  const safeSlug = pageSlug(slug);
  const page = await fetchPageWithContext(safeSlug, context);
  if (page || !context.legacyProjectId || context.legacyProjectId === context.projectId) return page;
  return fetchPageWithContext(safeSlug, {
    projectId: context.legacyProjectId,
    ownerId: context.legacyOwnerId || context.ownerId,
    slug: safeSlug,
  });
}

export async function fetchPublicServerPage(slug) {
  const safeSlug = pageSlug(slug);
  const res = await apiFetch(`/api/pages/${encodeURIComponent(safeSlug)}?public=1`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`공개 페이지 불러오기 실패: ${res.status}`);
  const data = await res.json();
  return data?.page || null;
}

export async function persistPage(page, authUser = null, options = {}) {
  const safePage = normalizePageForSave(page);
  if (!isServerPageMode()) {
    return { ok: true, mode: 'local' };
  }

  const slug = pageSlug(safePage);
  const context = projectContext(safePage, authUser);
  if (!context.session) {
    throw new ApiError('로그인 세션이 없습니다. 다시 로그인해주세요.', 401, { code: 'AUTH_SESSION_MISSING' });
  }
  return postJson(`/api/pages/${encodeURIComponent(slug)}`, {
    page: safePage,
    project: context,
    tab: options.tab || '',
    ...(options.expectedUpdatedAt ? { expectedUpdatedAt: options.expectedUpdatedAt } : {}),
  }, { headers: projectAuthHeaders(context) });
}

export async function fetchPageRevisions(page, authUser = null) {
  if (!isServerPageMode()) return null;

  const slug = pageSlug(page);
  const context = projectContext(page, authUser);
  const params = new URLSearchParams({
    projectId: context.projectId,
    ownerId: context.ownerId,
  });
  const res = await apiFetch(`/api/pages/${encodeURIComponent(slug)}/revisions?${params.toString()}`, {
    headers: projectAuthHeaders(context),
  });
  if (!res.ok) throw new Error(`페이지 저장본 불러오기 실패: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.revisions) ? data.revisions : [];
}

export async function fetchPageRevision(page, revisionId, authUser = null) {
  if (!isServerPageMode()) return null;

  const slug = pageSlug(page);
  const context = projectContext(page, authUser);
  const params = new URLSearchParams({
    projectId: context.projectId,
    ownerId: context.ownerId,
  });
  const res = await apiFetch(`/api/pages/${encodeURIComponent(slug)}/revisions/${encodeURIComponent(revisionId)}?${params.toString()}`, {
    headers: projectAuthHeaders(context),
  });
  if (!res.ok) throw new Error(`페이지 저장본 미리보기 실패: ${res.status}`);
  const data = await res.json();
  return data?.revision || null;
}

export async function restorePageRevision(page, revisionId, authUser = null) {
  if (!isServerPageMode()) return null;

  const slug = pageSlug(page);
  const context = projectContext(page, authUser);
  const data = await postJson(`/api/pages/${encodeURIComponent(slug)}/restore`, {
    revisionId,
    project: context,
  }, { headers: projectAuthHeaders(context) });
  return data?.page || null;
}
