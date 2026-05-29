import { isServerLeadMode } from '../config/runtimeConfig.js';
import { apiFetch, postJson, projectAuthHeaders } from './apiClient.js';
import { contextParams } from './leadRepository.js';
import { projectContext } from './projectContext.js';

export async function fetchServerEvents(page, authUser = null, options = {}) {
  if (!isServerLeadMode()) return null;

  const context = projectContext(page, authUser);
  const params = contextParams(context, {
    limit: options.limit || 1000,
    cursor: options.cursor ?? '',
    dateFrom: options.dateFrom || '',
    dateTo: options.dateTo || '',
  });

  const res = await apiFetch(`/api/events?${params.toString()}`, {
    headers: projectAuthHeaders(context),
  });
  if (!res.ok) throw new Error(`통계 이벤트 불러오기 실패: ${res.status}`);
  const data = await res.json();
  const events = Array.isArray(data?.events) ? data.events : [];

  if (options.withMeta) {
    return {
      events,
      total: Number(data?.total || events.length),
      nextCursor: data?.nextCursor ?? null,
      hasMore: !!data?.hasMore,
    };
  }

  return events;
}

export async function fetchAllServerEvents(page, authUser = null, options = {}) {
  const limit = Math.max(1, Math.min(5000, Number(options.limit || 2000)));
  const max = Math.max(limit, Math.min(20000, Number(options.max || 10000)));
  const result = [];
  let cursor = 0;
  let lastPage = { total: 0, nextCursor: null, hasMore: false };

  while (result.length < max) {
    const pageResult = await fetchServerEvents(page, authUser, {
      limit,
      cursor,
      withMeta: true,
      dateFrom: options.dateFrom || '',
      dateTo: options.dateTo || '',
    });
    if (!pageResult) return null;
    lastPage = pageResult;
    result.push(...pageResult.events);
    if (!pageResult.hasMore || pageResult.nextCursor == null) break;
    cursor = pageResult.nextCursor;
  }

  const events = result.slice(0, max);
  if (options.withMeta) {
    const truncated = !!lastPage.hasMore && result.length >= max;
    return {
      events,
      total: Number(lastPage.total || events.length),
      nextCursor: truncated ? lastPage.nextCursor : null,
      hasMore: truncated,
      partial: truncated,
      source: 'server',
    };
  }

  return events;
}

export async function fetchServerStatsSummary(page, authUser = null, options = {}) {
  if (!isServerLeadMode()) return null;

  const context = projectContext(page, authUser);
  const params = contextParams(context, {
    month: options.month || '',
    dateFrom: options.dateFrom || '',
    dateTo: options.dateTo || '',
  });

  const res = await apiFetch(`/api/stats/summary?${params.toString()}`, {
    headers: projectAuthHeaders(context),
  });
  if (!res.ok) throw new Error(`통계 요약을 불러오지 못했습니다: ${res.status}`);
  return res.json();
}

export async function persistEvent(event, page, authUser = null) {
  if (!isServerLeadMode()) return { ok: true, mode: 'local' };

  const context = projectContext(page, authUser);
  return postJson('/api/events', {
    event,
    project: context,
  }, { keepalive: true, headers: projectAuthHeaders(context) });
}
