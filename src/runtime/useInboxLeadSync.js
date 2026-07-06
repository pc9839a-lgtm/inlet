import { useEffect } from 'react';
import { isServerLeadMode } from '../config/runtimeConfig.js';
import { fetchServerLeads } from '../lib/leadRepository.js';
import { normalizeLeadItem } from '../lib/leadModel.js';
import { monthDateRange } from '../lib/monthRange.js';

export function useInboxLeadSync({
  tab,
  page,
  authUser,
  inboxFilters,
  pageSize,
  setLeads,
  setLeadPageMeta,
  setLeadsSyncing,
}) {
  useEffect(() => {
    if (tab !== 'inbox' || !isServerLeadMode()) return undefined;
    let alive = true;
    const monthRange = monthDateRange(inboxFilters.month);
    setLeadsSyncing(true);
    fetchServerLeads(page, authUser, {
      limit: pageSize,
      withMeta: true,
      kind: inboxFilters.kind === 'all' ? '' : inboxFilters.kind,
      status: inboxFilters.status === 'all' ? '' : inboxFilters.status,
      deliveryStatus: inboxFilters.deliveryStatus === 'all' ? '' : inboxFilters.deliveryStatus,
      q: inboxFilters.q,
      month: monthRange.month,
      dateFrom: monthRange.dateFrom,
      dateTo: monthRange.dateTo,
    })
      .then((result) => {
        if (!alive || !result) return;
        const serverLeads = Array.isArray(result) ? result : result.leads;
        setLeads((serverLeads || []).map(normalizeLeadItem));
        if (Array.isArray(result)) {
          setLeadPageMeta({ total: result.length, nextCursor: null, hasMore: false });
        } else {
          setLeadPageMeta({
            total: Number(result.total || 0),
            nextCursor: result.nextCursor ?? null,
            hasMore: !!result.hasMore,
          });
        }
      })
      .catch((error) => {
        console.warn('Server leads load failed:', error);
        setLeadPageMeta({ total: 0, nextCursor: null, hasMore: false });
      })
      .finally(() => {
        if (alive) setLeadsSyncing(false);
      });
    return () => { alive = false; };
  }, [tab, page, page?.slug, page?.projectId, authUser, inboxFilters.kind, inboxFilters.month, inboxFilters.status, inboxFilters.deliveryStatus, inboxFilters.q, pageSize, setLeads, setLeadPageMeta, setLeadsSyncing]);
}