import { isServerLeadMode } from '../config/runtimeConfig.js';
import { ApiError, apiFetch, postJson, projectAuthHeaders } from './apiClient.js';
import { downloadLeadsCsv } from './leadCsv.js';
import { projectContext } from './projectContext.js';

export function contextParams(context = {}, extra = {}) {
  const params = new URLSearchParams();
  Object.entries({ ...context, ...extra }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  return params;
}

async function readResponseError(res, fallback) {
  const raw = await res.text().catch(() => '');
  if (!raw) return { message: fallback, details: null };
  try {
    const data = JSON.parse(raw);
    return { message: data?.message || data?.error?.message || data?.error || fallback, details: data };
  } catch {
    return { message: raw || fallback, details: null };
  }
}

function throwApiError(error, status) {
  throw new ApiError(error.message, status, error.details);
}

export async function fetchServerLeads(page, authUser = null, options = {}) {
  if (!isServerLeadMode()) return null;

  const context = projectContext(page, authUser);
  const params = contextParams(context, {
    limit: options.limit || 500,
    cursor: options.cursor || 0,
    kind: options.kind || '',
    status: options.status || '',
    q: options.q || '',
    month: options.month || '',
    dateFrom: options.dateFrom || '',
    dateTo: options.dateTo || '',
    channel: options.channel || '',
    deliveryStatus: options.deliveryStatus || '',
  });
  const res = await apiFetch(`/api/leads?${params.toString()}`, {
    headers: projectAuthHeaders(context),
  });
  if (!res.ok) throwApiError(await readResponseError(res, `접수 데이터 불러오기 실패: ${res.status}`), res.status);
  const data = await res.json();
  if (options.withMeta) {
    return {
      leads: Array.isArray(data?.leads) ? data.leads : [],
      total: Number(data?.total || 0),
      nextCursor: data?.nextCursor ?? null,
      hasMore: !!data?.hasMore,
    };
  }
  return Array.isArray(data?.leads) ? data.leads : [];
}

export async function fetchAllServerLeads(page, authUser = null, options = {}) {
  if (!isServerLeadMode()) return null;

  const limit = Math.max(1, Math.min(5000, Number(options.limit || 2000)));
  const max = Math.max(limit, Math.min(20000, Number(options.max || 10000)));
  const result = [];
  let cursor = 0;
  let lastPage = { total: 0, nextCursor: null, hasMore: false };

  while (result.length < max) {
    const pageResult = await fetchServerLeads(page, authUser, {
      limit,
      cursor,
      withMeta: true,
      kind: '',
      status: '',
      q: '',
      month: options.month || '',
      dateFrom: options.dateFrom || '',
      dateTo: options.dateTo || '',
      channel: options.channel || '',
      deliveryStatus: options.deliveryStatus || '',
    });
    if (!pageResult) return null;
    lastPage = pageResult;
    result.push(...pageResult.leads);
    if (!pageResult.hasMore || pageResult.nextCursor == null) break;
    cursor = pageResult.nextCursor;
  }

  const leads = result.slice(0, max);
  if (options.withMeta) {
    const truncated = !!lastPage.hasMore && result.length >= max;
    return {
      leads,
      total: Number(lastPage.total || leads.length),
      nextCursor: truncated ? lastPage.nextCursor : null,
      hasMore: truncated,
      partial: truncated,
      source: 'server',
    };
  }

  return leads;
}

export async function fetchServerBlockedLeadHistory(page, authUser = null, options = {}) {
  if (!isServerLeadMode()) return null;

  const context = projectContext(page, authUser);
  const params = contextParams(context, {
    pageSlug: options.pageSlug || context.slug || '',
    month: options.month || new Date().toISOString().slice(0, 7),
    dateFrom: options.dateFrom || '',
    dateTo: options.dateTo || '',
    limit: options.limit || 50,
    cursor: options.cursor || 0,
  });
  const res = await apiFetch(`/api/leads/blocked-history?${params.toString()}`, {
    headers: projectAuthHeaders(context),
  });
  if (!res.ok) throwApiError(await readResponseError(res, `차단 내역을 불러오지 못했습니다: ${res.status}`), res.status);
  const data = await res.json();
  return {
    records: Array.isArray(data?.records) ? data.records : [],
    total: Number(data?.total || 0),
    nextCursor: data?.nextCursor ?? null,
    hasMore: !!data?.hasMore,
    queryPlan: data?.queryPlan || data?.meta || null,
  };
}

export async function persistLead(lead, page, authUser = null) {
  if (!isServerLeadMode()) return { ok: true, mode: 'local', lead };

  const data = await postJson('/api/leads', {
    lead,
    page,
    project: projectContext(page, authUser),
  }, { headers: projectAuthHeaders(projectContext(page, authUser)) });
  return data?.lead || lead;
}

export async function updateServerLead(id, patch, page, authUser = null) {
  if (!isServerLeadMode()) return null;

  const data = await postJson(`/api/leads/${encodeURIComponent(id)}`, {
    patch,
    project: projectContext(page, authUser),
  }, { method: 'PATCH', headers: projectAuthHeaders(projectContext(page, authUser)) });
  return data?.lead || null;
}

export async function deleteServerLead(id, page, authUser = null) {
  if (!isServerLeadMode()) return { ok: true, mode: 'local' };

  const context = projectContext(page, authUser);
  const params = contextParams(context);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/leads/${encodeURIComponent(id)}${suffix}`, {
    method: 'DELETE',
    headers: projectAuthHeaders(context),
  });
  if (!res.ok) throwApiError(await readResponseError(res, `접수 데이터 삭제 실패: ${res.status}`), res.status);
  return res.json().catch(() => ({ ok: true }));
}

export async function deliverServerLead(lead, page, authUser = null) {
  if (!isServerLeadMode()) return null;

  const context = projectContext(page, authUser);
  const data = await postJson(`/api/leads/${encodeURIComponent(lead.id)}/deliver`, {
    page,
    project: context,
  }, { headers: projectAuthHeaders(context) });
  return data?.delivery || data?.lead?.delivery || null;
}

export async function retryFailedServerLeads(page, authUser = null) {
  if (!isServerLeadMode()) return null;

  const context = projectContext(page, authUser);
  return postJson('/api/leads/retry-failed', {
    project: context,
  }, { headers: projectAuthHeaders(context) });
}

export async function downloadServerLeadsCsv(page, authUser = null, fallbackLeads = [], options = {}) {
  if (!isServerLeadMode()) {
    downloadLeadsCsv(fallbackLeads, page);
    return;
  }

  const context = projectContext(page, authUser);
  const params = contextParams(context, {
    month: options.month || '',
    dateFrom: options.dateFrom || '',
    dateTo: options.dateTo || '',
    kind: options.kind && options.kind !== 'all' ? options.kind : '',
    status: options.status && options.status !== 'all' ? options.status : '',
    deliveryStatus: options.deliveryStatus && options.deliveryStatus !== 'all' ? options.deliveryStatus : '',
    q: options.q || '',
  });
  const res = await apiFetch(`/api/leads/export.csv?${params.toString()}`, {
    headers: projectAuthHeaders(context),
  });
  if (!res.ok) throwApiError(await readResponseError(res, `CSV 내보내기 실패: ${res.status}`), res.status);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const slug = String(page?.slug || context.slug || 'my-page').replace(/[^\w가-힣-]/g, '-') || 'my-page';
  const date = options.month || new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}-leads-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
