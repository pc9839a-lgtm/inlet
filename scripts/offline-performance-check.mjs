import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { buildStats } from '../src/lib/statsMetrics.js';
import { filterLeadsForCsv } from '../src/lib/leadCsv.js';
import { monthDateRange } from '../src/lib/monthRange.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function iso(day, minute = 0) {
  return `2026-05-${String(day).padStart(2, '0')}T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00.000Z`;
}

function fixtureLeads(count = 10000) {
  return Array.from({ length: count }, (_, index) => ({
    id: `lead-${index}`,
    type: index % 5 === 0 ? 'reservation' : 'consult',
    status: index % 7 === 0 ? '?덉빟?꾨즺' : '?좉퇋',
    name: `Lead ${index}`,
    phone: `010-${String(index).padStart(4, '0')}-0000`,
    createdAt: index % 4 === 0 ? `2026-04-${String((index % 28) + 1).padStart(2, '0')}T03:00:00.000Z` : iso((index % 28) + 1, index % 1440),
    delivery: { status: index % 11 === 0 ? 'failed' : 'success' },
  }));
}

function fixtureEvents(count = 10000) {
  const types = ['page_view', 'cta_click', 'link_click', 'form_start', 'form_submit_success', 'reservation_submit_success'];
  return Array.from({ length: count }, (_, index) => ({
    id: `event-${index}`,
    type: types[index % types.length],
    pageId: `page-${index % 200}`,
    channel: ['direct', 'naver', 'google', 'kakao'][index % 4],
    device: ['mobile', 'desktop', 'tablet'][index % 3],
    createdAt: index % 4 === 0 ? `2026-04-${String((index % 28) + 1).padStart(2, '0')}T03:00:00.000Z` : iso((index % 28) + 1, index % 1440),
  }));
}

function fixtureSkewedEvents(count = 10000) {
  const types = ['page_view', 'cta_click', 'form_start', 'form_submit_attempt', 'form_submit_success', 'reservation_submit_attempt', 'reservation_submit_success'];
  return Array.from({ length: count }, (_, index) => ({
    id: `skew-event-${index}`,
    type: types[index % types.length],
    pageId: index < Math.floor(count * 0.8) ? 'heavy-page' : `small-page-${index}`,
    channel: ['direct', 'ads', 'search'][index % 3],
    device: ['mobile', 'desktop'][index % 2],
    createdAt: index % 5 === 0 ? `2026-04-${String((index % 28) + 1).padStart(2, '0')}T03:00:00.000Z` : iso((index % 28) + 1, index % 1440),
  }));
}

function timed(label, fn, maxMs) {
  const start = performance.now();
  const value = fn();
  const ms = performance.now() - start;
  assert(ms <= maxMs, `${label} took ${ms.toFixed(1)}ms > ${maxMs}ms`);
  return { value, ms: Number(ms.toFixed(1)) };
}

function monthFilter(items, range) {
  const from = new Date(`${range.dateFrom}T00:00:00`).getTime();
  const to = new Date(`${range.dateTo}T23:59:59.999`).getTime();
  return items.filter((item) => {
    const time = new Date(item.createdAt || item.savedAt || 0).getTime();
    return Number.isFinite(time) && time >= from && time <= to;
  });
}

function paginate(items, limit = 50, cursor = 0) {
  const page = items.slice(cursor, cursor + limit);
  return {
    page,
    total: items.length,
    nextCursor: cursor + page.length < items.length ? cursor + page.length : null,
  };
}

function serverStyleStatsSummary(eventsInput, leadsInput, period, now) {
  const stats = buildStats(eventsInput, leadsInput, period, now);
  const { filteredEvents: _events, filteredLeads: _leads, ...summary } = stats;
  return {
    totals: {
      events: _events.length,
      leads: _leads.length,
    },
    summary,
  };
}

const leads = fixtureLeads();
const events = fixtureEvents();
const skewedEvents = fixtureSkewedEvents();
const may = monthDateRange('2026-05');

const mayLeadFilter = timed('10k lead month filter', () => monthFilter(leads, may), 120);
assert(mayLeadFilter.value.length > 0 && mayLeadFilter.value.every((lead) => lead.createdAt.startsWith('2026-05')), 'month filter should exclude April leads');

const mayEventFilter = timed('10k event month filter', () => monthFilter(events, may), 120);
assert(mayEventFilter.value.length > 0 && mayEventFilter.value.every((event) => event.createdAt.startsWith('2026-05')), 'month filter should exclude April events');

const paginationRun = timed('10k lead pagination', () => {
  const first = paginate(mayLeadFilter.value.slice().reverse(), 10, 0);
  const second = paginate(mayLeadFilter.value.slice().reverse(), 10, first.nextCursor || 0);
  return { first, second };
}, 80);
assert(paginationRun.value.first.page.length === 10 && paginationRun.value.first.nextCursor === 10, 'first pagination page should stay at 10');
assert(paginationRun.value.second.page.length === 10, 'second pagination page should stay at 10');

const csvFilter = timed('10k lead month CSV filter', () => filterLeadsForCsv(leads, {
  dateFrom: may.dateFrom,
  dateTo: may.dateTo,
  kind: 'consult',
}), 250);
assert(csvFilter.value.length > 0 && csvFilter.value.every((lead) => lead.createdAt.startsWith('2026-05')), 'CSV month filter should exclude other months');

const statsRun = timed('10k events/leads stats calculation', () => buildStats(events, leads, 'thisMonth', new Date('2026-05-25T12:00:00+09:00')), 350);
assert(statsRun.value.filteredEvents.length <= events.length, 'stats should return filtered events');
assert(statsRun.value.filteredLeads.length <= leads.length, 'stats should return filtered leads');

const skewedEventFilter = timed('10k skewed event month filter', () => monthFilter(skewedEvents, may), 140);
assert(skewedEventFilter.value.length > 0 && skewedEventFilter.value.some((event) => event.pageId === 'heavy-page'), 'skewed fixture should keep heavy-page events');
assert(skewedEventFilter.value.every((event) => event.createdAt.startsWith('2026-05')), 'skewed month filter should exclude April events');

const skewedStatsRun = timed('10k skewed server-style stats summary', () => {
  const filteredEvents = monthFilter(skewedEvents, may);
  const filteredLeads = monthFilter(leads, may);
  return serverStyleStatsSummary(filteredEvents, filteredLeads, 'thisMonth', new Date('2026-05-25T12:00:00+09:00'));
}, 380);
assert(skewedStatsRun.value.totals.events > 0 && skewedStatsRun.value.totals.events <= skewedEventFilter.value.length, 'server-style stats summary should stay bounded to filtered events');
assert(!('filteredEvents' in skewedStatsRun.value.summary) && !('filteredLeads' in skewedStatsRun.value.summary), 'server-style stats summary should strip raw arrays');

const appSource = await readFile('src/App.jsx', 'utf8');
const leadRepository = await readFile('src/lib/leadRepository.js', 'utf8');
const eventRepository = await readFile('src/lib/eventRepository.js', 'utf8');
const inboxPanel = await readFile('src/panels/InboxPanel.jsx', 'utf8');
const serverSource = await readFile('server/index.mjs', 'utf8');
const d1Adapter = await readFile('server/storage/d1Adapter.mjs', 'utf8');

const jsonlFallbackPlan = {
  leads: { adapter: 'jsonl', indexed: false, fullScan: true, endpoint: '/api/leads' },
  events: { adapter: 'jsonl', indexed: false, fullScan: true, endpoint: '/api/events' },
  stats: { adapter: 'jsonl', indexed: false, fullScan: true, endpoint: '/api/stats/summary' },
  csv: { adapter: 'jsonl', indexed: false, fullScan: true, endpoint: '/api/leads/export.csv' },
  deliveryLogs: { adapter: 'jsonl', indexed: false, fullScan: true, endpoint: '/api/leads/delivery-logs' },
  retryQueue: { adapter: 'jsonl', indexed: false, fullScan: true, endpoint: '/api/leads/retry-queue' },
};

assert(appSource.includes('const INBOX_PAGE_SIZE = 10'), 'Inbox initial and load-more size should stay at 10');
assert(appSource.includes('monthDateRange(inboxFilters.month)'), 'Inbox server fetch should be month-bounded');
assert(appSource.includes("deliveryStatus: 'all'"), 'Inbox server fetch should keep delivery status out of the visible filter contract');
assert(appSource.includes('statsDateRange(statsMonth'), 'Stats server fetch should be capped to selected month and day-range period');
assert(inboxPanel.includes('type="month"'), 'Inbox UI should expose month selection');
assert(inboxPanel.includes("deliveryStatus: 'all'") && inboxPanel.includes('\uC6D4 CSV'), 'Inbox UI should expose monthly CSV without delivery filter noise');
assert(inboxPanel.includes('\uB354\uBCF4\uAE30') && inboxPanel.includes('\uC11C\uBC84 ${serverTotal}\uAC74 \uC911 ${loadedCount}\uAC74 \uB85C\uB4DC'), 'Inbox UI should clearly indicate partial server pagination');
assert(leadRepository.includes('dateFrom') && leadRepository.includes('dateTo') && leadRepository.includes('deliveryStatus'), 'Lead repository should pass date/delivery filters');
assert(eventRepository.includes('dateFrom') && eventRepository.includes('dateTo'), 'Event repository should pass date filters');
assert(serverSource.includes('dateRangeFilter') && serverSource.includes('deliveryStatus'), 'Server should filter leads/events by date and delivery status');
assert(serverSource.includes("url.searchParams.get('dateFrom')") && serverSource.includes("url.searchParams.get('dateTo')"), 'Server endpoints should read date range params');
assert(serverSource.includes("url.pathname === '/api/stats/summary'"), 'Server should expose stats summary aggregation contract');
assert(serverSource.includes('buildStatsSummary') && serverSource.includes('filteredEvents: _events'), 'Stats summary should aggregate without returning raw arrays');
assert(serverSource.includes('storageQueryPlan') && serverSource.includes('fullScan: true'), 'Server JSONL fallback should report fullScan query plans');
assert(serverSource.includes("type: 'leads'") && serverSource.includes("type: 'events'") && serverSource.includes("type: 'stats-events'") && serverSource.includes("type: 'stats-leads'") && serverSource.includes("type: 'delivery-logs'") && serverSource.includes("type: 'delivery-retry-queue'"), 'Server paged list and stats endpoints should expose JSONL query plans through the adapter boundary');
assert(serverSource.includes('activeIndexFields') && serverSource.includes('missingIndexFields') && serverSource.includes('recommendedIndex'), 'Server query plans should expose DB/index migration fields');
assert(serverSource.includes('indexKey') && serverSource.includes('migrationPriority') && serverSource.includes('storageMigrationPriority'), 'Server query plans should expose DB/index migration priority');
assert(serverSource.includes('findD1LeadsByIntakeSignals') && serverSource.includes('ip_rate_limit_1m'), 'Server should use D1 intake-signal lookup for dedupe/rate-limit policy');
assert(d1Adapter.includes('channelData') && d1Adapter.includes('deviceData'), 'D1 stats should aggregate indexed event channel/device dimensions');
assert(!serverSource.includes('async function listLeads(') && !serverSource.includes('async function listEvents(') && !serverSource.includes('function filterLeadList('), 'Legacy unpaged server list helpers must not be reintroduced');
assert(Object.values(jsonlFallbackPlan).every((plan) => plan.adapter === 'jsonl' && plan.fullScan === true && plan.indexed === false), 'perf QA should report JSONL fallback full scans explicitly');

console.log(JSON.stringify({
  ok: true,
  fixtures: { leads: leads.length, events: events.length, skewedEvents: skewedEvents.length },
  storage: {
    fallback: 'jsonl',
    fullScanEndpoints: jsonlFallbackPlan,
    nextIndexFields: {
      leads: ['project', 'page', 'month', 'status', 'kind', 'deliveryStatus', 'phoneNormalized', 'emailNormalized', 'clientId', 'ipHash', 'duplicate'],
      events: ['project', 'page', 'month', 'eventType', 'channel', 'device'],
      stats: ['project', 'page', 'month', 'eventType', 'channel', 'device', 'status', 'kind', 'deliveryStatus'],
    },
    queryPlanFields: ['activeIndexFields', 'missingIndexFields', 'recommendedIndex', 'indexKey', 'migrationPriority', 'nextAdapter'],
  },
  timings: {
    leadMonthFilterMs: mayLeadFilter.ms,
    eventMonthFilterMs: mayEventFilter.ms,
    paginationMs: paginationRun.ms,
    csvFilterMs: csvFilter.ms,
    statsCalculationMs: statsRun.ms,
    skewedEventFilterMs: skewedEventFilter.ms,
    skewedStatsSummaryMs: skewedStatsRun.ms,
  },
  checks: 32,
}, null, 2));

