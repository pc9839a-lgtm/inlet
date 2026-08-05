import { readFile } from 'node:fs/promises';
import { buildStats, getPeriodRange } from '../src/lib/statsMetrics.js';
import { previousStatsDateRanges } from '../src/lib/monthRange.js';
import { mergeStatsSummaryResults } from '../src/runtime/useStatsSummarySync.js';

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
  { id: 'pv-2', type: 'page_view', channel: 'direct', utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'spring', sourceUrl: 'https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=spring', device: 'desktop', createdAt: today },
  { id: 'cta-1', type: 'cta_click', label: 'hero', channel: 'direct', utmSource: 'naver', utmMedium: 'search', utmCampaign: 'brand', sourceUrl: 'https://example.com/?utm_source=naver&utm_medium=search&utm_campaign=brand', device: 'mobile', createdAt: today },
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
  { id: 'lead-1', type: '상담신청', status: '신규', createdAt: today },
  { id: 'lead-1', type: '상담신청', status: '신규', createdAt: today },
  { id: 'lead-2', type: '방문예약', status: '확인중', createdAt: today },
  { id: 'lead-category-booking', category: 'booking', status: '신규', createdAt: today },
  { type: '상담신청', name: '로컬중복', phone: '010-0000-0000', status: '신규', createdAt: today },
  { type: '상담신청', name: '로컬중복', phone: '010-0000-0000', status: '신규', createdAt: today },
  { id: 'lead-before-kst', type: '상담신청', status: '신규', createdAt: beforeKstToday },
  { id: 'lead-after-kst', type: '상담신청', status: '신규', createdAt: afterKstToday },
  { id: 'lead-yesterday', type: '상담신청', status: '신규', createdAt: yesterday },
  { id: 'lead-old', type: '상담신청', status: '신규', createdAt: old },
];

const range = getPeriodRange('today', now);
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
assert(todayStats.db === 4, `today db mismatch: ${todayStats.db}`);
assert(todayStats.filteredEvents.length === 10, 'duplicate events and Seoul boundary events should be ignored');
assert(todayStats.filteredLeads.length === 4, 'duplicate leads and Seoul boundary leads should be ignored');
assert(todayStats.consultLeads === 2, `consult lead mismatch: ${todayStats.consultLeads}`);
assert(todayStats.reservationLeads === 2, `reservation lead mismatch: ${todayStats.reservationLeads}`);
assert(todayStats.conversion === '200.0', `conversion mismatch: ${todayStats.conversion}`);
assert(todayStats.ctaConversion === '200.0', `cta conversion mismatch: ${todayStats.ctaConversion}`);
assert(todayStats.channelData.google === 1 && todayStats.channelData.naver >= 1, 'UTM source channel aggregation mismatch');
assert(todayStats.channelData.direct >= 1, 'events without UTM source should be direct');
assert(todayStats.ctaLabelData.hero === 1, 'CTA label aggregation mismatch');
assert(todayStats.statusData['신규'] === 3 && todayStats.statusData['확인중'] === 1, 'status breakdown mismatch');
assert(!('deliveryData' in todayStats), 'delivery stats should be removed from visible stats model');
assert(!todayStats.filteredEvents.some((event) => event.id === 'pv-before-kst' || event.id === 'pv-after-kst'), 'Seoul today should exclude adjacent UTC-day events');
assert(!todayStats.filteredLeads.some((lead) => lead.id === 'lead-before-kst' || lead.id === 'lead-after-kst'), 'Seoul today should exclude adjacent UTC-day leads');

const sevenDayStats = buildStats(events, leads, '7d', now);
assert(sevenDayStats.pv === 4, `7d pv mismatch: ${sevenDayStats.pv}`);
assert(sevenDayStats.db === 6, `7d db mismatch: ${sevenDayStats.db}`);
assert(sevenDayStats.trend.length === 7, `7d trend bucket mismatch: ${sevenDayStats.trend.length}`);
assert(sevenDayStats.trend.at(-1).id === '2026-05-21', `Seoul trend last bucket mismatch: ${sevenDayStats.trend.at(-1).id}`);

const yesterdayStats = buildStats(events, leads, 'yesterday', now);
assert(yesterdayStats.pv === 2 && yesterdayStats.db === 2, 'yesterday period mismatch');

const previousSevenDay = previousStatsDateRanges({ period: '7d', dateFrom: '2026-05-15', dateTo: '2026-05-21' });
assert(previousSevenDay.length === 1 && previousSevenDay[0].month === '2026-05' && previousSevenDay[0].dateFrom === '2026-05-08' && previousSevenDay[0].dateTo === '2026-05-14', 'previous stats range should use the immediately preceding equal-length period');

const previousMonthBoundary = previousStatsDateRanges({ period: '7d', dateFrom: '2026-05-01', dateTo: '2026-05-07' });
assert(previousMonthBoundary.length === 1 && previousMonthBoundary[0].month === '2026-04' && previousMonthBoundary[0].dateFrom === '2026-04-24' && previousMonthBoundary[0].dateTo === '2026-04-30', 'previous stats range should cross month boundaries without losing days');

const mergedComparison = mergeStatsSummaryResults([
  { summary: { pv: 10, cta: 4, db: 2, formStart: 3, submitAttempt: 2, submitSuccess: 1 } },
  { summary: { pv: 5, cta: 1, db: 1, formStart: 2, submitAttempt: 1, submitSuccess: 1 } },
]);
assert(mergedComparison.pv === 15 && mergedComparison.db === 3 && mergedComparison.conversion === '20.0', 'previous stats summaries should merge counts and recalculate conversion');
assert(mergedComparison.formStartRate === '33.3' && mergedComparison.formCompletionRate === '66.7', 'previous stats summaries should recalculate funnel rates');

const statsPanel = await readFile('src/panels/StatsPanel.jsx', 'utf8');
const inboxPanel = await readFile('src/panels/InboxPanel.jsx', 'utf8');
const inboxCss = await readFile('src/panels/InboxPanel.css', 'utf8');
const inboxOperationsCss = await readFile('src/panels/InboxOperations.css', 'utf8');
const statsPeriodCss = await readFile('src/styles/panels-stats-period-line.css', 'utf8');
assert(statsPanel.includes('eventPageMeta') && statsPanel.includes('leadPageMeta'), 'stats panel should accept pagination meta');
assert(statsPanel.includes('statsPartial') && statsPanel.includes('stats-partial-notice'), 'stats panel should expose partial data notice contract');
assert(statsPanel.includes('!serverMode && hasPartialStatsData') && statsPanel.includes('recentLeadTotal'), 'server aggregate stats should stay complete while recent lead rows disclose their limited count');
assert(statsPanel.includes('role="status"'), 'partial data notice should be announced as status');
assert(statsPanel.includes('onPeriodChange') && statsPanel.includes('controlledPeriod'), 'stats panel should notify App when the selected period changes');
assert(statsPanel.includes('PERIOD_OPTIONS') && statsPanel.includes('stats-range-tabs'), 'stats panel should expose 1/7/14/30 day period tabs');
assert(statsPanel.includes('type="month"'), 'stats panel should expose month-only filter control');
assert(statsPanel.includes('stats-line-chart') && statsPanel.includes('<polyline'), 'stats panel trend should render as a line chart');
assert(statsPanel.includes('\uC0C1\uC138 \uD1B5\uACC4') && !statsPanel.includes('\uC6D4\uAC04 \uCD94\uC774') && !statsPanel.includes('\uBC29\uBB38\u00B7\uC811\uC218'), 'stats trend title should use compact copy');
assert(!statsPanel.includes('\uB9C8\uC6B0\uC2A4\uB97C \uC62C\uB9AC\uBA74') && !statsPanel.includes('\uD750\uB984\uC744 \uD655\uC778'), 'stats trend should not render explanatory helper copy');
assert(statsPanel.includes('stats-chart-tooltip') && statsPanel.includes('onMouseEnter'), 'stats line chart should expose hover details');
assert(statsPanel.includes('fmtDateOnly') && !statsPanel.includes('fmtDate(lead.createdAt)'), 'recent leads should show date only without time');
assert(statsPanel.includes('serverStats') && statsPanel.includes('normalizeServerStats'), 'stats panel should render server aggregate payloads');
assert(statsPanel.includes('stats-funnel-card') && statsPanel.includes('formStartRate') && statsPanel.includes('formCompletionRate') && statsPanel.includes('reservationCompletionRate'), 'stats panel should expose server-backed form and reservation funnel completion');
assert(statsPanel.includes('stats-comparison-label') && statsPanel.includes('countMetricChange') && statsPanel.includes('rateMetricChange'), 'stats panel should show previous-period changes on summary metrics');
assert(!statsPanel.includes('DeliveryLogCard') && !statsPanel.includes('\uC804\uC1A1 \uB85C\uADF8') && !statsPanel.includes('\uC678\uBD80 \uC804\uC1A1'), 'stats panel should not expose delivery log cards');
assert(statsPeriodCss.includes('grid-template-columns: minmax(0, 1fr) 184px'), 'stats month picker should have enough width for year/month text');
assert(statsPeriodCss.includes('min-width: 168px'), 'stats month input should not collapse to year-only text');
assert(statsPeriodCss.includes('grid-template-columns: 58px minmax(96px, .8fr) minmax(112px, 1fr) 132px'), 'recent lead rows should use four visible columns only');

assert(inboxPanel.includes("if (!['failed', 'partial'].includes(status)) return null;") && inboxPanel.includes('const deliveryInfo = leadDeliveryInfo(lead)') && inboxPanel.includes('const selectedDeliveryInfo = selectedLead ? leadDeliveryInfo(selectedLead) : null') && inboxPanel.includes('retryLeadDelivery'), 'inbox delivery recovery should appear only for failed or partial deliveries');
assert(inboxPanel.includes('{deliveryInfo ?') && inboxPanel.includes('{selectedDeliveryInfo ?') && inboxOperationsCss.includes('.inbox-ops-mini-badge.delivery') && inboxOperationsCss.includes('.inbox-ops-detail-section.delivery-warning'), 'inbox CSS should style actionable delivery recovery states');
assert(inboxCss.includes('grid-template-columns: minmax(96px, 1fr) 64px 82px 66px') && inboxCss.includes('.lead-source-label'), 'inbox lead rows should reserve columns for source, status, date, and detail button');

const leadCaptureActions = await readFile('src/runtime/leadCaptureActions.js', 'utf8');
const publicPageRuntimeActions = await readFile('src/runtime/publicPageRuntimeActions.js', 'utf8');
const statsSummarySync = await readFile('src/runtime/useStatsSummarySync.js', 'utf8');
const workspacePanelProps = await readFile('src/runtime/createWorkspacePanelProps.js', 'utf8');
assert(statsSummarySync.includes('fetchServerStatsSummary') && statsSummarySync.includes('fetchServerLeads(page, authUser, { limit: 8'), 'split stats sync should load server aggregates and only recent lead rows');
assert(statsSummarySync.includes('previousStatsDateRanges') && statsSummarySync.includes('mergeStatsSummaryResults') && statsSummarySync.includes('comparisonPromise'), 'split stats sync should load an isolated previous-period aggregate comparison');
assert(!/setStatsPartial\(false\);\s*setServerStatsSummary\(null\);\s*Promise\.all/.test(statsSummarySync) && !/setStatsPartial\(true\);\s*setServerStatsSummary\(null\)/.test(statsSummarySync), 'stats channel refresh must preserve the previous server summary instead of flashing through local mode');
assert(statsPanel.includes('Math.max(86, hover.y)'), 'stats chart tooltip should keep enough top clearance for high data points');

assert(workspacePanelProps.includes('eventPageMeta: statsEventPageMeta') && workspacePanelProps.includes('leadPageMeta: statsLeadPageMeta'), 'workspace panel props should pass stats pagination metadata');
assert(leadCaptureActions.includes('utmSource') && leadCaptureActions.includes('utmMedium') && leadCaptureActions.includes('utmCampaign'), 'lead capture should keep UTM fields');
assert(publicPageRuntimeActions.includes('utmSource') && publicPageRuntimeActions.includes('utmMedium') && publicPageRuntimeActions.includes('utmCampaign'), 'public events should keep UTM fields');
assert(leadCaptureActions.includes('referrer') && leadCaptureActions.includes('sourceLabel') && publicPageRuntimeActions.includes('referrer') && publicPageRuntimeActions.includes('sourceLabel'), 'split lead and event actions should keep automatic source labels');

const trafficAttribution = await readFile('src/lib/trafficAttribution.js', 'utf8');
assert(trafficAttribution.includes('trafficAttributionFromUrl') && trafficAttribution.includes('utm_source'), 'traffic attribution should parse UTM source');
assert(trafficAttribution.includes('trafficChannelFromReferrer') && trafficAttribution.includes('sourceLabel'), 'traffic attribution should fall back to referrer and source label');

console.log(JSON.stringify({ ok: true, checks: 64 }, null, 2));
