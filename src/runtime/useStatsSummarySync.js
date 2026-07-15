import { useEffect } from 'react';
import { isServerLeadMode } from '../config/runtimeConfig.js';
import { fetchServerStatsSummary } from '../lib/eventRepository.js';
import { fetchServerLeads } from '../lib/leadRepository.js';
import { normalizeLeadItem } from '../lib/leadModel.js';
import { currentMonthValue, previousStatsDateRanges, statsDateRange } from '../lib/monthRange.js';

const COMPARISON_SUM_KEYS = [
  'pv',
  'cta',
  'link',
  'formStart',
  'submitAttempt',
  'submitSuccess',
  'reservationAttempt',
  'reservationSuccess',
  'consultLeads',
  'reservationLeads',
  'db',
];

function comparisonPercent(numerator, denominator) {
  return denominator ? ((Number(numerator || 0) / Number(denominator || 0)) * 100).toFixed(1) : '0.0';
}

export function mergeStatsSummaryResults(results = []) {
  const summaries = results.map((result) => result?.summary).filter(Boolean);
  if (!summaries.length) return null;
  const merged = Object.fromEntries(COMPARISON_SUM_KEYS.map((key) => [
    key,
    summaries.reduce((sum, summary) => sum + Number(summary[key] || 0), 0),
  ]));
  return {
    ...merged,
    conversion: comparisonPercent(merged.db, merged.pv),
    ctaConversion: comparisonPercent(merged.db, merged.cta),
    formStartRate: comparisonPercent(merged.formStart, merged.pv),
    formCompletionRate: comparisonPercent(merged.submitSuccess, merged.submitAttempt),
    reservationCompletionRate: comparisonPercent(merged.reservationSuccess, merged.reservationAttempt),
  };
}

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
    const previousRanges = previousStatsDateRanges(statsRange);
    const comparisonPromise = Promise.all(
      previousRanges.map((range) => fetchServerStatsSummary(page, authUser, { ...range, channel })),
    ).catch((error) => {
      console.warn('Previous stats comparison load failed:', error);
      return [];
    });
    setStatsPartial(false);
    setServerStatsSummary(null);
    Promise.all([
      fetchServerStatsSummary(page, authUser, { ...statsRange, channel }),
      fetchServerLeads(page, authUser, { limit: 8, withMeta: true, ...statsRange, channel }),
    ])
      .then(([summaryResult, leadResult]) => {
        if (!alive) return;
        setServerStatsSummary(summaryResult || null);
        if (summaryResult) {
          comparisonPromise.then((comparisonResults) => {
            if (!alive) return;
            const comparisonSummary = mergeStatsSummaryResults(comparisonResults);
            if (!comparisonSummary) return;
            setServerStatsSummary((current) => current ? {
              ...current,
              comparison: {
                dateFrom: previousRanges[0]?.dateFrom || '',
                dateTo: previousRanges[previousRanges.length - 1]?.dateTo || '',
                summary: comparisonSummary,
              },
            } : current);
          });
        }
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