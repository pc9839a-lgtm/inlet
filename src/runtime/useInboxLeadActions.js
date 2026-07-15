import { isServerLeadMode } from '../config/runtimeConfig.js';
import { downloadLeadsCsv } from '../lib/leadCsv.js';
import { downloadServerLeadsCsv, fetchServerLeads } from '../lib/leadRepository.js';
import { normalizeLeadItem } from '../lib/leadModel.js';
import { monthDateRange } from '../lib/monthRange.js';

export function useInboxLeadActions({
  authUser,
  inboxFilters,
  leadPageMeta,
  leads,
  leadsSyncing,
  page,
  pageSize,
  setLeadPageMeta,
  setLeads,
  setLeadsSyncing,
  showToast,
}) {
  const requestFilters = (overrides = {}) => {
    const monthRange = monthDateRange(overrides.month || inboxFilters.month);
    return {
      ...overrides,
      month: monthRange.month,
      dateFrom: monthRange.dateFrom,
      dateTo: monthRange.dateTo,
      kind: overrides.kind || inboxFilters.kind,
      status: overrides.status || inboxFilters.status,
      deliveryStatus: overrides.deliveryStatus || inboxFilters.deliveryStatus,
      q: overrides.q ?? inboxFilters.q,
    };
  };

  const serverLeadQuery = (filters, extra = {}) => ({
    limit: pageSize,
    withMeta: true,
    kind: filters.kind === 'all' ? '' : filters.kind,
    status: filters.status === 'all' ? '' : filters.status,
    deliveryStatus: filters.deliveryStatus === 'all' ? '' : filters.deliveryStatus,
    q: filters.q,
    month: filters.month,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    ...extra,
  });

  const exportLeadsCsv = async (visibleLeads = [], exportFilters = {}) => {
    const filters = requestFilters(exportFilters);
    try {
      if (isServerLeadMode()) {
        await downloadServerLeadsCsv(page, authUser, visibleLeads, filters);
        return;
      }
      downloadLeadsCsv(visibleLeads, page, { filters });
    } catch (error) {
      console.warn('Lead CSV export failed:', error);
      showToast(`CSV 내보내기에 실패했습니다. ${String(error?.message || error)}`, 'error');
    }
  };

  const refreshServerLeads = async ({ quiet = false } = {}) => {
    if (!isServerLeadMode()) return null;
    const filters = requestFilters();
    setLeadsSyncing(true);
    try {
      const result = await fetchServerLeads(page, authUser, serverLeadQuery(filters));
      const serverLeads = (result?.leads || []).map(normalizeLeadItem);
      setLeads(serverLeads);
      setLeadPageMeta({
        total: Number(result?.total || 0),
        nextCursor: result?.nextCursor ?? null,
        hasMore: !!result?.hasMore,
      });
      if (!quiet) showToast('최신 접수 데이터를 불러왔습니다.', 'success');
      return { ...result, leads: serverLeads };
    } catch (error) {
      console.warn('Server leads refresh failed:', error);
      if (!quiet) showToast(`접수 데이터 새로고침에 실패했습니다. ${String(error?.message || error)}`, 'error');
      return null;
    } finally {
      setLeadsSyncing(false);
    }
  };

  const loadMoreLeads = async () => {
    if (!leadPageMeta.hasMore || leadPageMeta.nextCursor == null || leadsSyncing) return;
    const filters = requestFilters();
    setLeadsSyncing(true);
    try {
      const result = await fetchServerLeads(page, authUser, serverLeadQuery(filters, { cursor: leadPageMeta.nextCursor }));
      const more = (result?.leads || []).map(normalizeLeadItem);
      setLeads((list) => {
        const seen = new Set(list.map((lead) => String(lead.id)));
        return [...list, ...more.filter((lead) => !seen.has(String(lead.id)))];
      });
      setLeadPageMeta({
        total: Number(result?.total || 0),
        nextCursor: result?.nextCursor ?? null,
        hasMore: !!result?.hasMore,
      });
    } catch (error) {
      console.warn('Server more leads load failed:', error);
    } finally {
      setLeadsSyncing(false);
    }
  };

  return { exportLeadsCsv, loadMoreLeads, refreshServerLeads };
}