import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { assert, authHeaders, fetchWithTimeout, json, runSmoke } from './lib/serverSmokeHarness.mjs';

async function backupCount(dataDir, projectId) {
  const backupDir = path.join(dataDir, 'projects', projectId, '.backups');
  try {
    const files = await readdir(backupDir);
    return files.filter((file) => file.includes('leads.jsonl') && file.endsWith('.bak')).length;
  } catch {
    return 0;
  }
}

await runSmoke('server-smoke-leads', async ({ baseUrl, dataDir }) => {
  const project = { projectId: 'smoke-leads', slug: 'smoke-leads' };
  const query = new URLSearchParams(project).toString();
  const page = { title: 'Smoke Leads', slug: 'smoke-leads' };

  const leadInputs = [
    { id: 'lead-a', type: 'consult', status: 'new', name: 'Alpha', phone: '010-0000-0001', memo: 'alpha memo' },
    { id: 'lead-b', type: 'reservation', status: 'new', name: 'Beta', phone: '010-0000-0002', memo: 'beta memo', values: { reservationDate: '2026-05-22', reservationTime: '10:30' } },
    { id: 'lead-c', type: 'consult', status: 'done', name: 'Gamma', phone: '010-0000-0003', memo: 'gamma memo' },
  ];

  for (const lead of leadInputs) {
    const { res, data } = await json({ baseUrl }, 'POST', '/api/leads', { project, page, lead });
    assert(res.ok && data.lead?.id === lead.id, `lead save failed: ${lead.id}`);
  }

  const duplicateSaved = await json({ baseUrl }, 'POST', '/api/leads', {
    project,
    page,
    lead: { id: 'lead-a-duplicate', type: 'consult', status: 'new', name: 'Alpha Again', phone: '01000000001', clientId: 'client-repeat-a', ipHash: 'ip-smoke-duplicate' },
  });
  assert(duplicateSaved.res.ok && duplicateSaved.data.lead?.duplicate, 'duplicate lead should be saved with duplicate metadata');
  assert(String(duplicateSaved.data.lead?.duplicateReason || '').includes('phone_30d'), 'duplicate reason should include phone_30d');

  const clientRepeat = await json({ baseUrl }, 'POST', '/api/leads', {
    project,
    page,
    lead: { id: 'lead-client-repeat', type: 'consult', status: 'new', name: 'Client Repeat', clientId: 'client-repeat-a', ipHash: 'ip-smoke-client' },
  });
  assert(clientRepeat.res.ok && clientRepeat.data.lead?.duplicate, 'client repeat should be saved as duplicate metadata');
  assert(String(clientRepeat.data.lead?.duplicateReason || '').includes('client_repeat_30m'), 'duplicate reason should include client_repeat_30m');

  const rateProject = { projectId: 'smoke-leads-rate', slug: 'smoke-rate' };
  for (let index = 0; index < 3; index += 1) {
    const { res } = await json({ baseUrl }, 'POST', '/api/leads', {
      project: rateProject,
      page,
      lead: { id: `rate-${index}`, type: 'consult', status: 'new', name: `Rate ${index}`, ipHash: 'ip-rate-1m', createdAt: `2026-05-21T03:00:0${index}.000Z` },
    });
    assert(res.ok, `rate seed lead should save: ${index}`);
  }
  const rateLimited = await json({ baseUrl }, 'POST', '/api/leads', {
    project: rateProject,
    page,
    lead: { id: 'rate-blocked', type: 'consult', status: 'new', name: 'Rate Blocked', ipHash: 'ip-rate-1m', createdAt: '2026-05-21T03:00:04.000Z' },
  });
  assert(rateLimited.res.status === 429 && rateLimited.data.code === 'LEAD_RATE_LIMITED', 'same IP 4th submission in 1 minute should be rate limited');

  const policyProject = { projectId: 'smoke-leads-policy', slug: 'smoke-policy' };
  const policyPage = {
    ...page,
    slug: 'smoke-policy',
    leadDuplicateSettings: {
      rejectIpDuplicate: true,
      rejectCookieDuplicate: true,
      formDuplicateLimitCount: 1,
      formDuplicateLimitWindow: '1mo',
      phoneEmailMode: 'block',
    },
  };
  const policySeed = await json({ baseUrl }, 'POST', '/api/leads', {
    project: policyProject,
    page: policyPage,
    lead: { id: 'policy-seed', type: 'consult', status: 'new', name: 'Policy Seed', phone: '010-7777-0001', clientId: 'policy-client', ipHash: 'ip-policy' },
  });
  assert(policySeed.res.ok, 'policy seed lead should save');
  const policyBlocked = await json({ baseUrl }, 'POST', '/api/leads', {
    project: policyProject,
    page: policyPage,
    lead: { id: 'policy-blocked', type: 'consult', status: 'new', name: 'Policy Blocked', phone: '01077770001', clientId: 'policy-client', ipHash: 'ip-policy' },
  });
  assert(policyBlocked.res.status === 429 && policyBlocked.data.code === 'LEAD_RATE_LIMITED', 'settings should block configured duplicate lead');
  assert(['phone_duplicate', 'client_duplicate_limit', 'ip_duplicate_limit'].includes(policyBlocked.data.reason), `unexpected policy block reason: ${policyBlocked.data.reason}`);

  const blockedHistoryQuery = new URLSearchParams({ ...policyProject, month: '2026-05', limit: '20' }).toString();
  const blockedHistory = await json({ baseUrl }, 'GET', `/api/leads/blocked-history?${blockedHistoryQuery}`);
  assert(blockedHistory.res.ok && blockedHistory.data.records?.length >= 1, 'blocked history should expose rate limited submissions');
  assert(blockedHistory.data.records.some((record) => record.reason === policyBlocked.data.reason), 'blocked history should include block reason');

  const firstPage = await json({ baseUrl }, 'GET', `/api/leads?${query}&limit=2`);
  assert(firstPage.data.leads.length === 2, 'lead first page length mismatch');
  assert(firstPage.data.total === 5 && firstPage.data.hasMore, 'lead pagination meta mismatch');

  const secondPage = await json({ baseUrl }, 'GET', `/api/leads?${query}&limit=2&cursor=${firstPage.data.nextCursor}`);
  assert(secondPage.data.leads.length === 2 && secondPage.data.hasMore, 'lead second page mismatch');

  const filtered = await json({ baseUrl }, 'GET', `/api/leads?${query}&kind=reservation&q=beta`);
  assert(filtered.data.total === 1 && filtered.data.leads[0].id === 'lead-b', 'lead server filter mismatch');

  const expectedUpdatedAt = filtered.data.leads[0].updatedAt || filtered.data.leads[0].savedAt || filtered.data.leads[0].createdAt;
  const updated = await json({ baseUrl }, 'PATCH', '/api/leads/lead-b', {
    project,
    patch: { memo: '=updated memo', __expectedUpdatedAt: expectedUpdatedAt },
  });
  assert(updated.res.ok && updated.data.lead.memo === '=updated memo', 'lead update failed');
  assert(await backupCount(dataDir, project.projectId) >= 1, 'lead update should create jsonl backup before rewrite');

  const conflict = await json({ baseUrl }, 'PATCH', '/api/leads/lead-b', {
    project,
    patch: { memo: 'stale memo', __expectedUpdatedAt: 'stale-version' },
  });
  assert(conflict.res.status === 409, `lead conflict expected 409, got ${conflict.res.status}`);
  assert(conflict.data.code === 'LEAD_REVISION_CONFLICT' && conflict.data.latest?.id === 'lead-b', 'lead conflict schema mismatch');

  const unboundedCsv = await fetchWithTimeout(`${baseUrl}/api/leads/export.csv?${query}&ids=lead-b`, { headers: authHeaders() });
  assert(unboundedCsv.status === 400, `unbounded CSV export expected 400, got ${unboundedCsv.status}`);

  const csv = await fetchWithTimeout(`${baseUrl}/api/leads/export.csv?${query}&month=2026-05&ids=lead-b`, { headers: authHeaders() });
  const csvText = await csv.text();
  assert(csv.ok && csvText.includes('"\'=updated memo"') && !csvText.includes('alpha memo'), 'lead csv ids filter failed');
  assert(csvText.includes('reservationDate') && csvText.includes('2026-05-22') && csvText.includes('10:30'), 'lead csv reservation columns failed');

  const deleted = await json({ baseUrl }, 'DELETE', `/api/leads/lead-a?${query}`);
  assert(deleted.res.ok && deleted.data.id === 'lead-a', 'lead delete failed');
  assert(await backupCount(dataDir, project.projectId) >= 2, 'lead delete should create jsonl backup before rewrite');

  const otherProject = { projectId: 'smoke-leads-other', slug: 'smoke-leads' };
  const wrongProjectDelete = await json({ baseUrl }, 'DELETE', `/api/leads/lead-b?${new URLSearchParams(otherProject).toString()}`);
  assert(wrongProjectDelete.res.status === 404, `cross-project delete expected 404, got ${wrongProjectDelete.res.status}`);

  const bulkProject = { projectId: 'smoke-leads-bulk', slug: 'smoke-bulk' };
  const bulkQuery = new URLSearchParams(bulkProject).toString();
  for (let index = 0; index < 305; index += 1) {
    const lead = {
      id: `bulk-${index}`,
      type: 'consult',
      status: 'new',
      name: `Bulk ${index}`,
      ipHash: `ip-bulk-${index}`,
      createdAt: new Date(Date.UTC(2026, 4, 1, 0, index, 0)).toISOString(),
    };
    const { res, data } = await json({ baseUrl }, 'POST', '/api/leads', { project: bulkProject, page, lead });
    assert(res.ok, `bulk lead save failed: ${index} ${res.status} ${JSON.stringify(data)}`);
  }
  const bulkFirst = await json({ baseUrl }, 'GET', `/api/leads?${bulkQuery}&limit=200`);
  assert(bulkFirst.data.total === 305 && bulkFirst.data.leads.length === 200 && bulkFirst.data.hasMore, `bulk first page mismatch: ${JSON.stringify({ status: bulkFirst.res.status, total: bulkFirst.data.total, count: bulkFirst.data.leads?.length, hasMore: bulkFirst.data.hasMore, error: bulkFirst.data.error })}`);
  const bulkNext = await json({ baseUrl }, 'GET', `/api/leads?${bulkQuery}&limit=200&cursor=${bulkFirst.data.nextCursor}`);
  assert(bulkNext.data.leads.length === 105 && !bulkNext.data.hasMore && bulkNext.data.nextCursor == null, 'bulk next page mismatch');

  const monthProject = { projectId: 'smoke-leads-month', slug: 'smoke-month' };
  const monthQuery = new URLSearchParams(monthProject).toString();
  let targetStatus = '';
  for (let index = 0; index < 75; index += 1) {
    const isApril = index < 15;
    const isTarget = index >= 15 && index < 20;
    const lead = {
      id: `month-${index}`,
      type: isTarget || index % 3 === 0 ? 'reservation' : 'consult',
      status: index % 2 === 0 ? 'new' : 'done',
      name: isTarget ? `May Target ${index}` : `Month Lead ${index}`,
      phone: `010-1234-${String(index).padStart(4, '0')}`,
      memo: isTarget ? 'target month smoke' : 'month smoke',
      createdAt: isApril
        ? `2026-04-${String((index % 15) + 1).padStart(2, '0')}T03:00:00.000Z`
        : `2026-05-${String((index % 28) + 1).padStart(2, '0')}T03:00:00.000Z`,
      delivery: { status: isTarget ? 'failed' : 'success' },
      ipHash: `ip-month-${index}`,
      values: isTarget ? { reservationDate: '2026-05-22' } : {},
    };
    const saved = await json({ baseUrl }, 'POST', '/api/leads', { project: monthProject, page, lead });
    assert(saved.res.ok, `month lead save failed: ${index}`);
    if (isTarget && !targetStatus) targetStatus = saved.data.lead.status;
  }

  const mayPage = await json({ baseUrl }, 'GET', `/api/leads?${monthQuery}&month=2026-05&limit=50`);
  assert(mayPage.res.ok && mayPage.data.total === 60 && mayPage.data.leads.length === 50 && mayPage.data.hasMore, 'May month page mismatch');
  assert(mayPage.data.leads.every((lead) => String(lead.createdAt || '').startsWith('2026-05')), 'May month query should exclude April');

  const mayNext = await json({ baseUrl }, 'GET', `/api/leads?${monthQuery}&month=2026-05&limit=50&cursor=${mayPage.data.nextCursor}`);
  assert(mayNext.res.ok && mayNext.data.leads.length === 10 && !mayNext.data.hasMore, 'May cursor page mismatch');

  const comboParams = new URLSearchParams({
    ...monthProject,
    month: '2026-05',
    limit: '50',
    kind: 'reservation',
    status: targetStatus,
    deliveryStatus: 'failed',
    q: 'target',
  });
  const combo = await json({ baseUrl }, 'GET', `/api/leads?${comboParams.toString()}`);
  assert(combo.res.ok && combo.data.total === 5, 'month kind/status/delivery/q filter mismatch');
  assert(combo.data.leads.every((lead) => String(lead.createdAt || '').startsWith('2026-05') && lead.delivery?.status === 'failed'), 'combined month filter returned wrong leads');

  const comboCsv = await fetchWithTimeout(`${baseUrl}/api/leads/export.csv?${comboParams.toString()}`, { headers: authHeaders() });
  const comboCsvText = await comboCsv.text();
  assert(comboCsv.ok, 'month combined CSV export request failed');
  assert(comboCsvText.includes('May Target 15') && comboCsvText.includes('target month smoke'), 'month combined CSV export should include filtered May target leads');
  assert(!comboCsvText.includes('Month Lead 0') && !comboCsvText.includes('Month Lead 20'), 'month combined CSV export should exclude adjacent month and non-matching May leads');
  assert(!comboCsvText.includes('2026-04-'), 'month combined CSV export should not include April leads');

  const statsSummary = await json({ baseUrl }, 'GET', `/api/stats/summary?${monthQuery}&month=2026-05&period=thisMonth`);
  assert(statsSummary.res.ok && statsSummary.data.source === 'server', 'stats summary source mismatch');
  assert(statsSummary.data.totals?.leads === 60 && !('filteredLeads' in (statsSummary.data.summary || {})), 'stats summary should aggregate without raw lead arrays');
}, { timeoutMs: 10000 });
