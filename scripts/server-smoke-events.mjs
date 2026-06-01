import { assert, json, runSmoke } from './lib/serverSmokeHarness.mjs';

await runSmoke('server-smoke-events', async ({ baseUrl }) => {
  const project = { projectId: 'smoke-events', slug: 'smoke-events' };
  const query = new URLSearchParams(project).toString();
  const events = [
    { id: 'event-a', type: 'page_view', label: 'home', channel: 'direct', device: 'desktop', createdAt: new Date().toISOString() },
    { id: 'event-b', type: 'cta_click', label: 'call', channel: 'direct', device: 'mobile', createdAt: new Date().toISOString() },
    { id: 'event-c', type: 'form_submit', label: 'consult', channel: 'ads', device: 'mobile', createdAt: new Date().toISOString() },
  ];

  for (const event of events) {
    const { res } = await json({ baseUrl }, 'POST', '/api/events', { project, event });
    assert(res.ok, `event save failed: ${event.id}`);
  }

  const duplicateEvent = await json({ baseUrl }, 'POST', '/api/events', { project, event: { ...events[1], id: 'event-b-dup' } });
  assert(duplicateEvent.data.event?.deduped === true, 'event dedupe failed');

  const firstPage = await json({ baseUrl }, 'GET', `/api/events?${query}&limit=2`);
  assert(firstPage.data.events.length === 2 && firstPage.data.hasMore, 'event pagination first page mismatch');

  const nextPage = await json({ baseUrl }, 'GET', `/api/events?${query}&limit=2&cursor=${firstPage.data.nextCursor}`);
  assert(nextPage.data.events.length === 1 && !nextPage.data.hasMore, 'event pagination next page mismatch');

  const statsProject = { projectId: 'smoke-events-stats', slug: 'smoke-events-stats' };
  const statsQuery = new URLSearchParams(statsProject).toString();
  const statTypes = [
    'page_view',
    'cta_click',
    'form_start',
    'form_submit_attempt',
    'form_submit_success',
    'reservation_submit_attempt',
    'reservation_submit_success',
  ];
  const monthEvents = [
    ...statTypes.map((type, index) => ({
      id: `may-${type}`,
      type,
      pageId: index < 3 ? 'heavy-page' : `small-page-${index}`,
      label: `may ${type}`,
      channel: index % 2 === 0 ? 'direct' : 'ads',
      device: index % 2 === 0 ? 'mobile' : 'desktop',
      createdAt: `2026-05-${String(index + 1).padStart(2, '0')}T03:00:00.000Z`,
    })),
    ...statTypes.map((type, index) => ({
      id: `april-${type}`,
      type,
      pageId: index < 3 ? 'heavy-page' : `small-page-${index}`,
      label: `april ${type}`,
      channel: 'direct',
      device: 'mobile',
      createdAt: `2026-04-${String(index + 1).padStart(2, '0')}T03:00:00.000Z`,
    })),
  ];

  for (const event of monthEvents) {
    const { res } = await json({ baseUrl }, 'POST', '/api/events', { project: statsProject, event });
    assert(res.ok, `month event save failed: ${event.id}`);
  }

  const page = { title: 'Smoke Stats', slug: 'smoke-events-stats' };
  const leads = [
    { id: 'may-lead-consult', type: 'consult', status: 'new', name: 'May Consult', phone: '010-9000-0001', createdAt: '2026-05-03T03:00:00.000Z' },
    { id: 'may-lead-reservation', type: 'reservation', status: 'new', name: 'May Reservation', phone: '010-9000-0002', createdAt: '2026-05-04T03:00:00.000Z' },
    { id: 'april-lead-consult', type: 'consult', status: 'new', name: 'April Consult', phone: '010-9000-0003', createdAt: '2026-04-03T03:00:00.000Z' },
  ];
  for (const lead of leads) {
    const { res } = await json({ baseUrl }, 'POST', '/api/leads', { project: statsProject, page, lead });
    assert(res.ok, `month stat lead save failed: ${lead.id}`);
  }

  const maySummary = await json({ baseUrl }, 'GET', `/api/stats/summary?${statsQuery}&month=2026-05&period=thisMonth`);
  const mayStats = maySummary.data.summary || {};
  assert(maySummary.res.ok && maySummary.data.source === 'server', 'May stats summary source mismatch');
  assert(maySummary.data.totals?.events === 7 && maySummary.data.totals?.leads === 2, 'May stats summary should count only selected month totals');
  assert(mayStats.pv === 1 && mayStats.cta === 1 && mayStats.formStart === 1, 'May stats summary basic funnel mismatch');
  assert(mayStats.submitAttempt === 1 && mayStats.submitSuccess === 1, 'May stats summary submit funnel mismatch');
  assert(mayStats.reservationAttempt === 1 && mayStats.reservationSuccess === 1, 'May stats summary reservation funnel mismatch');
  assert(mayStats.db === 2 && mayStats.reservationLeads === 1, 'May stats summary lead funnel mismatch');
  assert(!('filteredEvents' in mayStats) && !('filteredLeads' in mayStats), 'stats summary should not expose raw arrays');

  const emptySummary = await json({ baseUrl }, 'GET', `/api/stats/summary?${statsQuery}&month=2026-06&period=thisMonth`);
  const emptyStats = emptySummary.data.summary || {};
  assert(emptySummary.res.ok, 'empty month stats summary request failed');
  assert(emptySummary.data.totals?.events === 0 && emptySummary.data.totals?.leads === 0, 'empty month should return zero totals');
  assert(emptyStats.pv === 0 && emptyStats.cta === 0 && emptyStats.db === 0, 'empty month should not leak stale stats');

  const utmProject = { projectId: 'smoke-events-utm', slug: 'smoke-events-utm' };
  const utmQuery = new URLSearchParams(utmProject).toString();
  const utmEvent = {
    id: 'utm-event-1',
    type: 'page_view',
    label: 'utm landing',
    channel: 'legacy-channel',
    sourceUrl: 'https://example.com/?utm_source=naver&utm_medium=cpc&utm_campaign=summer',
    device: 'mobile',
    createdAt: '2026-05-10T03:00:00.000Z',
  };
  const utmSave = await json({ baseUrl }, 'POST', '/api/events', { project: utmProject, event: utmEvent });
  assert(utmSave.res.ok, 'UTM event save failed');
  assert(utmSave.data.event?.channel === 'naver', 'UTM source should override legacy channel');
  assert(utmSave.data.event?.utmMedium === 'cpc' && utmSave.data.event?.utmCampaign === 'summer', 'UTM medium/campaign should be saved');
  const utmSummary = await json({ baseUrl }, 'GET', `/api/stats/summary?${utmQuery}&month=2026-05&period=thisMonth&channel=naver`);
  assert(utmSummary.data.summary?.pv === 1 && utmSummary.data.summary?.channelData?.naver === 1, 'UTM channel stats mismatch');
}, { timeoutMs: 10000 });
