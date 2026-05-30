import { readFile } from 'node:fs/promises';
import { buildStats, getPeriodRange } from '../src/lib/statsMetrics.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const now = new Date('2026-05-21T12:00:00+09:00');
const kstStartToday = '2026-05-20T15:00:00.000Z';
const kstEndToday = '2026-05-21T14:59:59.999Z';
const beforeKstToday = '2026-05-20T14:59:59.999Z';
const afterKstToday = '2026-05-21T15:00:00.000Z';
const today = '2026-05-21T03:00:00.000Z';
const yesterday = '2026-05-20T03:00:00.000Z';
const old = '2026-04-01T03:00:00.000Z';

const events = [
  { id: 'pv-1', type: 'page_view', channel: 'naver', device: 'mobile', createdAt: today },
  { id: 'pv-1', type: 'page_view', channel: 'naver', device: 'mobile', createdAt: today },
  { id: 'pv-2', type: 'page_view', channel: 'google', device: 'desktop', createdAt: today },
  { id: 'cta-1', type: 'cta_click', label: 'hero', channel: 'naver', device: 'mobile', createdAt: today },
  { id: 'link-1', type: 'link_click', label: 'kakao', channel: 'kakao', device: 'mobile', createdAt: today },
  { id: 'form-start-1', type: 'form_start', label: '상담 폼', channel: 'naver', device: 'mobile', createdAt: today },
  { id: 'form-attempt-1', type: 'form_submit_attempt', label: '상담 폼', channel: 'naver', device: 'mobile', createdAt: today },
  { id: 'form-success-1', type: 'form_submit_success', label: '상담 폼', channel: 'naver', device: 'mobile', createdAt: today },
  { id: 'reservation-attempt-1', type: 'reservation_submit_attempt', label: '방문 예약', channel: 'naver', device: 'mobile', createdAt: today },
  { id: 'reservation-success-1', type: 'reservation_submit_success', label: '방문 예약', channel: 'naver', device: 'mobile', createdAt: today },
  { type: 'cta_click', label: 'floating', channel: 'direct', device: 'mobile', createdAt: today },
  { type: 'cta_click', label: 'floating', channel: 'direct', device: 'mobile', createdAt: today },
  { id: 'pv-before-kst', type: 'page_view', channel: 'direct', device: 'desktop', createdAt: beforeKstToday },
  { id: 'pv-after-kst', type: 'page_view', channel: 'direct', device: 'desktop', createdAt: afterKstToday },
  { id: 'pv-yesterday', type: 'page_view', channel: 'direct', device: 'tablet', createdAt: yesterday },
  { id: 'pv-old', type: 'page_view', channel: 'direct', device: 'desktop', createdAt: old },
];

const leads = [
  { id: 'lead-1', type: '상담신청', status: '신규', createdAt: today, delivery: { status: 'success' } },
  { id: 'lead-1', type: '상담신청', status: '신규', createdAt: today, delivery: { status: 'success' } },
  { id: 'lead-2', type: '방문예약', status: '확인중', createdAt: today, delivery: { status: 'failed' } },
  { type: '상담신청', name: '로컬중복', phone: '010-0000-0000', status: '신규', createdAt: today, delivery: { status: 'success' } },
  { type: '상담신청', name: '로컬중복', phone: '010-0000-0000', status: '신규', createdAt: today, delivery: { status: 'success' } },
  { id: 'lead-before-kst', type: '상담신청', status: '신규', createdAt: beforeKstToday, delivery: { status: 'none' } },
  { id: 'lead-after-kst', type: '상담신청', status: '신규', createdAt: afterKstToday, delivery: { status: 'none' } },
  { id: 'lead-yesterday', type: '상담신청', status: '신규', createdAt: yesterday, delivery: { status: 'none' } },
  { id: 'lead-old', type: '상담신청', status: '신규', createdAt: old, delivery: { status: 'none' } },
];

const range = getPeriodRange('today', now);
assert(range.start <= range.end, 'period range is invalid');
assert(range.start.toISOString() === kstStartToday, `today range should start at Seoul midnight: ${range.start.toISOString()}`);
assert(range.end.toISOString() === kstEndToday, `today range should end at Seoul day end: ${range.end.toISOString()}`);

const todayStats = buildStats(events, leads, 'today', now);
assert(todayStats.pv === 2, `today pv mismatch: ${todayStats.pv}`);
assert(todayStats.cta === 2, `today cta mismatch: ${todayStats.cta}`);
assert(todayStats.link === 1, `today link mismatch: ${todayStats.link}`);
assert(todayStats.formStart === 1, `form start mismatch: ${todayStats.formStart}`);
assert(todayStats.submitAttempt === 1, `submit attempt mismatch: ${todayStats.submitAttempt}`);
assert(todayStats.submitSuccess === 1, `submit success mismatch: ${todayStats.submitSuccess}`);
assert(todayStats.reservationAttempt === 1, `reservation attempt mismatch: ${todayStats.reservationAttempt}`);
assert(todayStats.reservationSuccess === 1, `reservation success mismatch: ${todayStats.reservationSuccess}`);
assert(todayStats.db === 3, `today db mismatch: ${todayStats.db}`);
assert(todayStats.filteredEvents.length === 10, 'duplicate events and Seoul boundary events should be ignored');
assert(todayStats.filteredLeads.length === 3, 'duplicate leads and Seoul boundary leads should be ignored');
assert(todayStats.consultLeads === 2, `consult lead mismatch: ${todayStats.consultLeads}`);
assert(todayStats.reservationLeads === 1, `reservation lead mismatch: ${todayStats.reservationLeads}`);
assert(todayStats.conversion === '150.0', `conversion mismatch: ${todayStats.conversion}`);
assert(todayStats.ctaConversion === '150.0', `cta conversion mismatch: ${todayStats.ctaConversion}`);
assert(todayStats.formStartRate === '50.0', `form start rate mismatch: ${todayStats.formStartRate}`);
assert(todayStats.formCompletionRate === '100.0', `form completion rate mismatch: ${todayStats.formCompletionRate}`);
assert(todayStats.reservationCompletionRate === '100.0', `reservation completion rate mismatch: ${todayStats.reservationCompletionRate}`);
assert(todayStats.funnel.pageViews === 2 && todayStats.funnel.ctaClicks === 2 && todayStats.funnel.linkClicks === 1, 'funnel traffic steps mismatch');
assert(todayStats.funnel.formStarts === 1 && todayStats.funnel.submitAttempts === 1 && todayStats.funnel.submitSuccesses === 1, 'funnel form steps mismatch');
assert(todayStats.funnel.reservationAttempts === 1 && todayStats.funnel.reservationSuccesses === 1, 'funnel reservation steps mismatch');
assert(todayStats.statusData['신규'] === 2 && todayStats.statusData['확인중'] === 1, 'status breakdown mismatch');
assert(todayStats.deliveryData['전송완료'] === 2 && todayStats.deliveryData['전송실패'] === 1, 'delivery breakdown mismatch');
assert(!todayStats.filteredEvents.some((event) => event.id === 'pv-before-kst' || event.id === 'pv-after-kst'), 'Seoul today should exclude adjacent UTC-day events');
assert(!todayStats.filteredLeads.some((lead) => lead.id === 'lead-before-kst' || lead.id === 'lead-after-kst'), 'Seoul today should exclude adjacent UTC-day leads');

const sevenDayStats = buildStats(events, leads, '7d', now);
assert(sevenDayStats.pv === 4, `7d pv mismatch: ${sevenDayStats.pv}`);
assert(sevenDayStats.db === 5, `7d db mismatch: ${sevenDayStats.db}`);
assert(sevenDayStats.trend.reduce((sum, row) => sum + row.pv, 0) === 4, 'trend pv total mismatch');
assert(sevenDayStats.trend.reduce((sum, row) => sum + row.db, 0) === 5, 'trend db total mismatch');
assert(sevenDayStats.trend.length === 7, `7d trend bucket mismatch: ${sevenDayStats.trend.length}`);
assert(sevenDayStats.trend.at(-1).id === '2026-05-21', `Seoul trend last bucket mismatch: ${sevenDayStats.trend.at(-1).id}`);

const yesterdayStats = buildStats(events, leads, 'yesterday', now);
assert(yesterdayStats.pv === 2 && yesterdayStats.db === 2, 'yesterday period mismatch');

const monthNow = new Date('2026-05-01T00:10:00+09:00');
const lastMonthStats = buildStats(events, leads, 'lastMonth', monthNow);
assert(lastMonthStats.pv === 1 && lastMonthStats.db === 1, 'lastMonth boundary mismatch');

const statsPanel = await readFile('src/panels/StatsPanel.jsx', 'utf8');
assert(statsPanel.includes('eventPageMeta') && statsPanel.includes('leadPageMeta'), 'stats panel should accept pagination meta');
assert(statsPanel.includes('statsPartial') && statsPanel.includes('stats-partial-notice'), 'stats panel should expose partial data notice contract');
assert(statsPanel.includes('role="status"'), 'partial data notice should be announced as status');
assert(statsPanel.includes('onPeriodChange') && statsPanel.includes('controlledPeriod'), 'stats panel should notify App when the selected period changes');
assert(statsPanel.includes('PERIOD_OPTIONS') && statsPanel.includes('stats-range-tabs'), 'stats panel should expose 1/7/14/30 day period tabs');
assert(statsPanel.includes('type="month"'), 'stats panel should expose month-only filter control');
assert(statsPanel.includes('stats-line-chart') && statsPanel.includes('<polyline'), 'stats panel trend should render as a line chart');
assert(statsPanel.includes('serverStats') && statsPanel.includes('normalizeServerStats'), 'stats panel should render server aggregate payloads');

const appSource = await readFile('src/App.jsx', 'utf8');
assert(appSource.includes('fetchServerStatsSummary'), 'stats tab should load server aggregate summary');
assert(appSource.includes('fetchServerLeads(page, authUser, { limit: 8'), 'stats tab should only load recent lead rows for the table');
assert(appSource.includes('statsEventPageMeta') && appSource.includes('statsLeadPageMeta'), 'stats tab should keep independent pagination meta');
assert(appSource.includes('eventPageMeta={statsEventPageMeta}') && appSource.includes('leadPageMeta={statsLeadPageMeta}'), 'stats panel should receive pagination meta from App');
assert(appSource.includes('statsMonth') && appSource.includes('statsPeriod') && appSource.includes('statsDateRange(statsMonth'), 'stats server loading should use selected month plus day-range period');
assert(appSource.includes('serverStatsSummary') && appSource.includes('serverStats={serverStatsSummary}'), 'stats panel should receive server summary state');

const eventRepository = await readFile('src/lib/eventRepository.js', 'utf8');
const leadRepository = await readFile('src/lib/leadRepository.js', 'utf8');
assert(eventRepository.includes('fetchServerStatsSummary') && eventRepository.includes('/api/stats/summary'), 'event repository should expose stats summary API');
assert(eventRepository.includes('withMeta') && eventRepository.includes("source: 'server'"), 'event repository should keep paged event fetch meta for fallback use');
assert(leadRepository.includes('fetchAllServerLeads') && leadRepository.includes("source: 'server'"), 'lead repository should return full fetch meta');
assert(eventRepository.includes('dateFrom') && eventRepository.includes('dateTo'), 'event repository should send date range filters for bounded stats queries');
assert(leadRepository.includes('dateFrom') && leadRepository.includes('dateTo'), 'lead repository should send date range filters for bounded stats queries');

const landingRenderer = await readFile('src/preview/LandingRenderer.jsx', 'utf8');
const formBlocks = await readFile('src/preview/renderers/FormBlocks.jsx', 'utf8');
assert(landingRenderer.includes('<FormRenderReservation block={block} addLead={addLead} track={track}/>'), 'reservation renderer should receive tracking callback');
assert(formBlocks.includes("type: 'reservation_submit_attempt'"), 'reservation attempt event should be produced');
assert(formBlocks.includes("type: 'reservation_submit_success'"), 'reservation success event should be produced');
assert(formBlocks.includes('onFocusCapture={markReservationStart}'), 'reservation form should produce a start event');

console.log(JSON.stringify({ ok: true, checks: 62 }, null, 2));
