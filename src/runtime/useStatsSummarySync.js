import { useEffect } from 'react';
import { isServerLeadMode } from '../config/runtimeConfig.js';
import { fetchServerStatsSummary } from '../lib/eventRepository.js';
import { fetchServerLeads } from '../lib/leadRepository.js';
import { normalizeLeadItem } from '../lib/leadModel.js';
import { currentMonthValue, statsDateRange } from '../lib/monthRange.js';

export function useStatsSummarySync({
  tab,
  page,
  authUser,
  events,
  leads,
  statsMonth,
  statsPeriod,
  statsChannel,
  setEvents,
  setLeads,
  setStatsEventPageMeta,
  setStatsLeadPageMeta,
  setStatsPartial,
  setServerStatsSummary,
}) {
  useEffect(() => {
    if (tab !== 'stats') return undefined;
    if (!isServerLeadMode()) {
      setStatsEventPageMeta({ total: events.length, nextCursor: null, hasMore: false, source: 'local' });
      setStatsLeadPageMeta({ total: leads.length, nextCursor: null, hasMore: false, source: 'local' });
      setStatsPartial(false);
      setServerStatsSummary(null);
      return undefined;
    }
    let alive = true;
    const statsRange = statsDateRange(statsMonth || currentMonthValue(), statsPeriod || '30d');
    const channel = statsChannel === 'all' ? '' : statsChannel;
    setStatsPartial(false);
    setServerStatsSummary(null);
    Promise.all([
      fetchServerStatsSummary(page, authUser, { ...statsRange, channel }),
      fetchServerLeads(page, authUser, { limit: 8, withMeta: true, ...statsRange, channel }),
    ])
      .then(([summaryResult, leadResult]) => {
        if (!alive) return;
        setServerStatsSummary(summaryResult || null);
        setEvents([]);
        if (summaryResult) {
          setStatsEventPageMeta({
            total: Number(summaryResult?.totals?.events || 0),
            nextCursor: null,
            hasMore: false,
            source: summaryResult.source || 'server',
          });
        }
        if (leadResult) {
          setLeads((leadResult.leads || []).map(normalizeLeadItem));
          setStatsLeadPageMeta({
            total: Number(leadResult.total || 0),
            nextCursor: leadResult.nextCursor ?? null,
            hasMore: !!leadResult.hasMore,
            source: leadResult.source || 'server',
          });
        }
        setStatsPartial(false);
      })
      .catch((error) => {
        console.warn('Server stats data load failed:', error);
        if (alive) {
          setStatsPartial(true);
          setServerStatsSummary(null);
        }
      });
    return () => { alive = false; };
  }, [tab, page, page?.slug, page?.projectId, authUser, events.length, leads.length, statsMonth, statsPeriod, statsChannel, setEvents, setLeads, setStatsEventPageMeta, setStatsLeadPageMeta, setStatsPartial, setServerStatsSummary]);
}