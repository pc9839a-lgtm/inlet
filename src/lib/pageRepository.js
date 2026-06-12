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

function noStoreHeaders(headers = {}) {
  return {
    'Cache-Control': 'no-cache, no-store',
    Pragma: 'no-cache',
    ...(headers || {}),
  };
}

function canRetryWithAccountProject(error, authUser = null) {
  const status = Number(error?.status || 0);
  const code = String(error?.details?.code || error?.details?.errorCode || '').trim();
  const role = String(authUser?.role || authUser?.accessMode || 'master').trim().toLowerCase();
  const masterLike = !role || ['master', 'owner', 'builder'].includes(role);
  const message = String(error?.message || error || '');
  return masterLike
    && (status === 403 || code === 'PROJECT_ACCESS_REQUIRED' || code === 'PROJECT_ACCESS_DENIED')
    && !/Email verification|account is suspended|account is deleted/i.test(message);
}

function accountOwnedPageForRetry(page = {}, authUser = null) {
  const slug = pageSlug(page);
  const context = projectContext({ slug }, authUser ? { ...authUser, projectId: '' } : authUser);
  return {
    page: {
      ...page,
      slug,
      projectId: context.projectId,
      ownerId: context.ownerId,
    },
    context,
  };
}

async function readJsonError(res, fallback) {
  const raw = await res.text().catch(() => '');
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw);
    return data?.message || data?.error?.message || data?.error || fallback;
  } catch {
    return raw || fallback;
  }
}

async function fetchPageWithContext(safeSlug, context = {}) {
  const params = pageContextParams(context);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/pages/${encodeURIComponent(safeSlug)}${query}`, {
    cache: 'no-store',
    headers: noStoreHeaders(projectAuthHeaders(context)),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readJsonError(res, `페이지 불러오기 실패: ${res.status}`));
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
  const res = await apiFetch(`/api/pages/${encodeURIComponent(safeSlug)}?public=1&fresh=${Date.now()}`, {
    cache: 'no-store',
    headers: noStoreHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readJsonError(res, `공개 페이지 불러오기 실패: ${res.status}`));
  const data = await res.json();
  return data?.page || null;
}

function publicPageMatchesSaved(publicPage = null, savedPage = {}) {
  if (!publicPage || !savedPage) return false;
  if (String(publicPage.slug || '') !== String(savedPage.slug || '')) return false;
  if (String(publicPage.projectId || '') !== String(savedPage.projectId || '')) return false;
  const publicRevision = Number(publicPage.revision || 0);
  const savedRevision = Number(savedPage.revision || 0);
  if (publicRevision && savedRevision && publicRevision < savedRevision) return false;
  const publicUpdatedAt = String(publicPage.updatedAt || '').trim();
  const savedUpdatedAt = String(savedPage.updatedAt || '').trim();
  if (publicUpdatedAt && savedUpdatedAt && publicUpdatedAt !== savedUpdatedAt) return false;
  if (publicPageRenderFingerprint(publicPage) !== publicPageRenderFingerprint(savedPage)) return false;
  return true;
}

function publicPageRenderFingerprint(page = {}) {
  return stablePublicStringify({
    title: page.title || '',
    slug: page.slug || '',
    theme: page.theme || {},
    blocks: Array.isArray(page.blocks) ? page.blocks : [],
    settings: page.settings || {},
  });
}

function stablePublicStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stablePublicStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stablePublicStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyPublicPageSave(savedPage = {}) {
  const slug = pageSlug(savedPage);
  let publicPage = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    publicPage = await fetchPublicServerPage(slug);
    if (publicPageMatchesSaved(publicPage, savedPage)) return publicPage;
    if (attempt < 2) await sleep(250 * (attempt + 1));
  }
  const detail = publicPage
    ? '공개 URL의 내용이 방금 저장한 내용과 다릅니다.'
    : '공개 URL에서 저장한 페이지를 찾지 못했습니다.';
  throw new ApiError(`서버 저장 후 공개 페이지 반영 확인에 실패했습니다. ${detail} 다시 저장해주세요.`, 409, {
    code: 'PAGE_PUBLIC_VERIFY_FAILED',
    slug,
    savedRevision: savedPage.revision || 0,
    publicRevision: publicPage?.revision || 0,
    savedUpdatedAt: savedPage.updatedAt || '',
    publicUpdatedAt: publicPage?.updatedAt || '',
    savedFingerprint: publicPageRenderFingerprint(savedPage),
    publicFingerprint: publicPage ? publicPageRenderFingerprint(publicPage) : '',
  });
}

export async function persistPage(page, authUser = null, options = {}) {
  const safePage = normalizePageForSave(page);
  if (!isServerPageMode()) {
    return { ok: true, mode: 'local' };
  }

  const slug = pageSlug(safePage);
  const context = projectContext(safePage, authUser);
  const pageWithContext = normalizePageForSave({
    ...safePage,
    slug,
    projectId: context.projectId,
    ownerId: context.ownerId,
  });
  if (!context.session) {
    throw new ApiError('로그인 세션이 없습니다. 다시 로그인해주세요.', 401, { code: 'AUTH_SESSION_MISSING' });
  }
  const payload = {
    page: pageWithContext,
    project: context,
    tab: options.tab || '',
    ...(options.expectedUpdatedAt ? { expectedUpdatedAt: options.expectedUpdatedAt } : {}),
  };
  try {
    const result = await postJson(`/api/pages/${encodeURIComponent(slug)}`, payload, { headers: projectAuthHeaders(context) });
    if (result?.page && options.verifyPublic !== false) await verifyPublicPageSave(result.page);
    return result;
  } catch (error) {
    if (!canRetryWithAccountProject(error, authUser)) throw error;
    const retry = accountOwnedPageForRetry(pageWithContext, authUser);
    if (!retry.context.projectId || retry.context.projectId === context.projectId) throw error;
    const result = await postJson(`/api/pages/${encodeURIComponent(retry.page.slug)}`, {
      ...payload,
      page: retry.page,
      project: retry.context,
      recoveredProjectAccess: true,
    }, { headers: projectAuthHeaders(retry.context) });
    if (result?.page && options.verifyPublic !== false) await verifyPublicPageSave(result.page);
    return result;
  }
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
  if (!res.ok) throw new Error(await readJsonError(res, `페이지 저장본 불러오기 실패: ${res.status}`));
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
  if (!res.ok) throw new Error(await readJsonError(res, `페이지 저장본 미리보기 실패: ${res.status}`));
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
