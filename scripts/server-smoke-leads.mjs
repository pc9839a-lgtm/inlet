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
    { id: 'lead-a', type: 'consult', status: 'new', name: 'Alpha', phone: '010-0000-0001', memo: 'alpha memo', createdAt: '2026-05-21T03:00:00.000Z' },
    { id: 'lead-b', type: 'reservation', status: 'new', name: 'Beta', phone: '010-0000-0002', memo: 'beta memo', createdAt: '2026-05-22T03:00:00.000Z', values: { reservationDate: '2026-05-22', reservationTime: '10:30' } },
    { id: 'lead-c', type: 'consult', status: 'done', name: 'Gamma', phone: '010-0000-0003', memo: 'gamma memo', createdAt: '2026-05-23T03:00:00.000Z' },
  ];

  for (const lead of leadInputs) {
    const { res, data } = await json({ baseUrl }, 'POST', '/api/leads', { project, page, lead });
    assert(res.ok && data.lead?.id === lead.id, `lead save failed: ${lead.id}`);
  }

  const emailProject = { projectId: 'smoke-leads-email', slug: 'smoke-email' };
  const emailPage = {
    title: 'Smoke Email Alerts',
    slug: emailProject.slug,
    integrations: {
      email: {
        enabled: true,
        to: 'owner@example.test',
        consult: true,
        reservation: true,
      },
    },
  };
  const savedEmailPage = await json({ baseUrl }, 'POST', `/api/pages/${encodeURIComponent(emailProject.slug)}`, {
    project: emailProject,
    page: emailPage,
  });
  assert(savedEmailPage.res.ok, 'email alert page save failed');
  assert(savedEmailPage.data.page?.integrations?.email?.to === 'owner@example.test', 'email alert recipient should be persisted on the page');

  const emailAlertLead = await json({ baseUrl }, 'POST', '/api/leads', {
    project: emailProject,
    page: { slug: emailProject.slug },
    lead: {
      id: 'lead-email-alert',
      type: 'consult',
      status: 'new',
      name: 'Email Alert Lead',
      phone: '010-0000-1100',
      createdAt: '2026-05-24T05:00:00.000Z',
    },
  });
  assert(emailAlertLead.res.ok, 'email alert lead should save');
  assert(emailAlertLead.data.delivery?.status === 'success', `email alert delivery expected success: ${JSON.stringify(emailAlertLead.data.delivery)}`);
  assert(emailAlertLead.data.delivery?.logs?.some((log) => log.provider === 'ses' && log.status === 'success'), 'email alert lead should send through SES delivery provider');
  const duplicateEmailAlertLead = await json({ baseUrl }, 'POST', '/api/leads', {
    project: emailProject,
    page: { slug: emailProject.slug },
    lead: {
      id: 'lead-email-alert',
      type: 'consult',
      status: 'new',
      name: 'Email Alert Lead Duplicate',
      phone: '010-0000-1100',
      createdAt: '2026-05-24T05:00:00.000Z',
    },
  });
  assert(duplicateEmailAlertLead.res.ok, 'duplicate email alert lead should save without failing');
  assert(
    duplicateEmailAlertLead.data.delivery?.logs?.some((log) => log.provider === 'ses' && log.skippedDuplicate === true && log.message === '이미 전송 완료'),
    'duplicate email alert lead should not send the same SES notification twice',
  );

  const reservationOnlyProject = { projectId: 'smoke-leads-email-reservation-kind', slug: 'smoke-email-reservation-kind' };
  const reservationOnlyPage = {
    title: 'Smoke Reservation Kind Alerts',
    slug: reservationOnlyProject.slug,
    integrations: {
      email: {
        enabled: true,
        to: 'reservation-owner@example.test',
        consult: false,
        reservation: true,
      },
    },
  };
  const savedReservationOnlyPage = await json({ baseUrl }, 'POST', `/api/pages/${encodeURIComponent(reservationOnlyProject.slug)}`, {
    project: reservationOnlyProject,
    page: reservationOnlyPage,
  });
  assert(savedReservationOnlyPage.res.ok, 'reservation-only email page save failed');
  const reservationKindLead = await json({ baseUrl }, 'POST', '/api/leads', {
    project: reservationOnlyProject,
    page: { slug: reservationOnlyProject.slug },
    lead: {
      id: 'lead-email-reservation-kind',
      kind: 'booking',
      status: 'new',
      name: 'Reservation Kind Lead',
      phone: '010-0000-1108',
      createdAt: '2026-05-24T05:03:00.000Z',
    },
  });
  assert(reservationKindLead.res.ok, 'reservation kind lead should save');
  assert(
    reservationKindLead.data.delivery?.logs?.some((log) => log.provider === 'ses' && log.status === 'success'),
    `reservation kind lead should send through reservation email path: ${JSON.stringify(reservationKindLead.data.delivery)}`,
  );
  const unknownKindLead = await json({ baseUrl }, 'POST', '/api/leads', {
    project: reservationOnlyProject,
    page: { slug: reservationOnlyProject.slug },
    lead: {
      id: 'lead-email-unknown-kind',
      type: '',
      status: 'new',
      name: 'Unknown Email Lead',
      phone: '010-0000-0999',
      createdAt: '2026-05-22T03:08:00.000Z',
    },
  });
  assert(unknownKindLead.res.ok, 'unknown kind lead should save');
  assert(
    unknownKindLead.data.delivery?.logs?.some((log) => log.provider === 'ses' && log.status === 'success'),
    `unknown kind lead should not silently skip enabled email alerts: ${JSON.stringify(unknownKindLead.data.delivery)}`,
  );

  const fallbackEmailProject = {
    projectId: 'smoke-leads-email-fallback',
    slug: 'smoke-email-fallback',
    clientEmail: 'fallback-owner@example.test',
    plan: 'paid',
  };
  const fallbackEmailPage = {
    title: 'Smoke Email Fallback Alerts',
    slug: fallbackEmailProject.slug,
    integrations: {
      email: {
        enabled: true,
        to: '',
        consult: true,
        reservation: true,
      },
    },
  };
  const savedFallbackEmailPage = await json({ baseUrl }, 'POST', `/api/pages/${encodeURIComponent(fallbackEmailProject.slug)}`, {
    project: fallbackEmailProject,
    page: fallbackEmailPage,
  });
  assert(savedFallbackEmailPage.res.ok, 'email fallback alert page save failed');
  assert(!savedFallbackEmailPage.data.page?.integrations?.email?.to, 'paid email fallback page should preserve blank recipient before delivery');
  const fallbackEmailLead = await json({ baseUrl }, 'POST', '/api/leads', {
    project: fallbackEmailProject,
    page: { slug: fallbackEmailProject.slug },
    lead: {
      id: 'lead-email-fallback-alert',
      type: 'consult',
      status: 'new',
      name: 'Email Fallback Lead',
      phone: '010-0000-1109',
      createdAt: '2026-05-24T05:05:00.000Z',
    },
  });
  assert(fallbackEmailLead.res.ok, 'email fallback lead should save');
  assert(
    fallbackEmailLead.data.delivery?.logs?.some((log) => log.provider === 'ses' && log.status === 'success'),
    `email fallback lead should send through SES using project email fallback: ${JSON.stringify(fallbackEmailLead.data.delivery)}`,
  );

  const publicEmailProject = { projectId: 'smoke-leads-public-email-owner', slug: 'smoke-public-email' };
  const publicEmailPage = {
    title: 'Smoke Public Email Alerts',
    slug: publicEmailProject.slug,
    blocks: [
      {
        id: 'embed-smoke-form',
        type: 'form',
        visible: true,
        s: {
          title: '외부 입력폼',
          submit: '접수',
          questions: [
            { id: 'name', label: '이름', type: 'short', required: true },
            { id: 'phone', label: '연락처', type: 'phone', required: true },
            { id: 'budget', label: '예산대', type: 'select', options: ['1천만원 이하', '1천만원 이상'] },
          ],
        },
      },
    ],
    integrations: {
      email: {
        enabled: true,
        to: 'public-owner@example.test',
        consult: true,
        reservation: true,
      },
    },
  };
  const savedPublicEmailPage = await json({ baseUrl }, 'POST', `/api/pages/${encodeURIComponent(publicEmailProject.slug)}`, {
    project: publicEmailProject,
    page: publicEmailPage,
  });
  assert(savedPublicEmailPage.res.ok, 'public email alert page save failed');
  const stalePublicLead = await json({ baseUrl }, 'POST', '/api/leads', {
    project: { projectId: 'stale-public-project-id', slug: publicEmailProject.slug },
    page: { slug: publicEmailProject.slug },
    lead: {
      id: 'lead-public-stale-project',
      type: 'consult',
      status: 'new',
      name: 'Public Stale Project Lead',
      phone: '010-0000-1101',
      createdAt: '2026-05-24T05:10:00.000Z',
    },
  });
  assert(stalePublicLead.res.ok, 'public lead with stale project id should save');
  assert(stalePublicLead.data.delivery?.logs?.some((log) => log.provider === 'ses' && log.status === 'success'), 'public lead should use stored slug page email settings');
  const publicOwnerLeads = await json({ baseUrl }, 'GET', `/api/leads?projectId=${encodeURIComponent(publicEmailProject.projectId)}&slug=${encodeURIComponent(publicEmailProject.slug)}&month=2026-05&limit=10`);
  assert(publicOwnerLeads.data.leads?.some((lead) => lead.id === 'lead-public-stale-project'), 'public lead should be stored under slug-owned project id');
  const staleProjectLeads = await json({ baseUrl }, 'GET', `/api/leads?projectId=stale-public-project-id&slug=${encodeURIComponent(publicEmailProject.slug)}&month=2026-05&limit=10`);
  assert(staleProjectLeads.data.total === 0, 'public lead must not remain under stale payload project id');
  const slugOnlyPublicLead = await json({ baseUrl }, 'POST', '/api/leads', {
    project: { slug: publicEmailProject.slug },
    page: { slug: publicEmailProject.slug },
    lead: {
      id: 'lead-public-slug-only',
      type: 'consult',
      status: 'new',
      name: 'Public Slug Only Lead',
      phone: '010-0000-1102',
      createdAt: '2026-05-24T05:20:00.000Z',
    },
  });
  assert(slugOnlyPublicLead.res.ok, 'public embed lead with slug only should save');
  assert(slugOnlyPublicLead.data.delivery?.logs?.some((log) => log.provider === 'ses' && log.status === 'success'), 'public slug-only lead should use stored page email settings');
  const slugOnlyOwnerLeads = await json({ baseUrl }, 'GET', `/api/leads?projectId=${encodeURIComponent(publicEmailProject.projectId)}&slug=${encodeURIComponent(publicEmailProject.slug)}&month=2026-05&limit=10`);
  assert(slugOnlyOwnerLeads.data.leads?.some((lead) => lead.id === 'lead-public-slug-only'), 'public slug-only lead should be stored under slug-owned project id');

  const publicFormConfigRead = await fetchWithTimeout(`${baseUrl}/api/pages/${encodeURIComponent(publicEmailProject.slug)}?public=1&fresh=${Date.now()}`, {
    method: 'GET',
    headers: { Origin: 'https://external-form.example' },
  }, 5000);
  const publicFormConfig = await publicFormConfigRead.json();
  assert(publicFormConfigRead.ok, 'public embed form config should load from slug');
  assert(publicFormConfigRead.headers.get('access-control-allow-origin') === '*', 'public embed form config should allow external origins');
  const publicFormPage = publicFormConfig.page || {};
  const publicFormBlock = (publicFormPage.blocks || []).find((block) => block.id === 'embed-smoke-form');
  assert(publicFormPage.projectId === publicEmailProject.projectId, 'public embed page config must include owning project id');
  assert(publicFormBlock?.type === 'form', 'public embed form block should be available');

  const embedPayload = {
    page: {
      id: publicFormPage.id || '',
      projectId: publicFormPage.projectId || '',
      slug: publicFormPage.slug || '',
      title: publicFormPage.title || '',
    },
    project: {
      projectId: publicFormPage.projectId || '',
      slug: publicFormPage.slug || '',
    },
    lead: {
      id: 'lead-public-hosted-embed-form',
      type: '상담',
      kind: 'consult',
      formId: publicFormBlock.id,
      pageSlug: publicFormPage.slug,
      clientId: 'embed-client-smoke',
      source: 'embed',
      name: 'Hosted Embed Lead',
      phone: '01000001103',
      values: {
        name: 'Hosted Embed Lead',
        phone: '01000001103',
        budget: '1천만원 이상',
        sourceUrl: 'https://external-form.example/pagero?utm_source=blog&utm_medium=embed&utm_campaign=lead',
      },
      answers: [
        { id: 'name', label: '이름', value: 'Hosted Embed Lead' },
        { id: 'phone', label: '연락처', value: '01000001103' },
        { id: 'budget', label: '예산대', value: '1천만원 이상' },
      ],
      createdAt: '2026-05-24T05:30:00.000Z',
      createdMonth: '2026-05',
    },
  };
  const embedLeadRes = await fetchWithTimeout(`${baseUrl}/api/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://external-form.example',
    },
    body: JSON.stringify(embedPayload),
  }, 5000);
  const embedLead = await embedLeadRes.json();
  assert(embedLeadRes.ok, `hosted embedded form lead should save: ${JSON.stringify(embedLead)}`);
  assert(embedLeadRes.headers.get('access-control-allow-origin') === '*', 'hosted embedded form lead post should allow external origins');
  assert((embedLead.lead?.projectId || embedLead.lead?.project?.projectId) === publicEmailProject.projectId, 'hosted embedded form lead should be stored under owning project id');
  assert(embedLead.lead?.pageSlug === publicEmailProject.slug, 'hosted embedded form lead should keep page slug');
  assert(embedLead.lead?.values?.budget === '1천만원 이상', 'hosted embedded form lead should keep dynamic form values');
  const embedOwnerLeads = await json({ baseUrl }, 'GET', `/api/leads?projectId=${encodeURIComponent(publicEmailProject.projectId)}&slug=${encodeURIComponent(publicEmailProject.slug)}&month=2026-05&limit=20`);
  assert(embedOwnerLeads.data.leads?.some((lead) => lead.id === 'lead-public-hosted-embed-form'), 'hosted embedded form lead should appear in owner inbox query');

  const attributedLead = await json({ baseUrl }, 'POST', '/api/leads', {
    project,
    page: { ...page, url: 'https://pagero.kr/smoke-leads' },
    lead: {
      id: 'lead-source',
      type: 'consult',
      status: 'new',
      name: 'Source Lead',
      phone: '010-0000-0099',
      createdAt: '2026-05-24T03:00:00.000Z',
      values: { '관심 유형': '상담', budget: '300만원' },
      answers: [
        { id: 'budget', label: '예산', value: '300만원' },
      ],
      source: {
        sourceUrl: 'https://external.example/form?utm_source=naver&utm_medium=cpc&utm_campaign=smoke',
        referrer: 'https://search.naver.com',
        utmSource: 'naver',
        utmMedium: 'cpc',
        utmCampaign: 'smoke',
      },
    },
  });
  assert(attributedLead.res.ok, 'attributed public lead should save');
  assert(attributedLead.data.lead?.sourceUrl?.includes('utm_source=naver'), 'public lead source URL should be normalized');
  assert(attributedLead.data.lead?.utmSource === 'naver' && attributedLead.data.lead?.utmCampaign === 'smoke', 'public lead UTM should be normalized');

  const urlOnlyAttributionLead = await json({ baseUrl }, 'POST', '/api/leads', {
    project,
    page: { ...page, url: 'https://pagero.kr/smoke-leads' },
    lead: {
      id: 'lead-source-url-only',
      type: 'consult',
      status: 'new',
      name: 'URL Only Source',
      phone: '010-0000-0100',
      createdAt: '2026-05-24T04:00:00.000Z',
      source: {
        sourceUrl: 'https://external.example/form?utm_source=kakao&utm_medium=social&utm_campaign=url-only',
        referrer: 'https://talk.kakao.com',
      },
    },
  });
  assert(urlOnlyAttributionLead.res.ok, 'URL-only attributed public lead should save');
  assert(urlOnlyAttributionLead.data.lead?.utmSource === 'kakao', 'UTM source should be derived from sourceUrl');
  assert(urlOnlyAttributionLead.data.lead?.utmMedium === 'social', 'UTM medium should be derived from sourceUrl');
  assert(urlOnlyAttributionLead.data.lead?.utmCampaign === 'url-only', 'UTM campaign should be derived from sourceUrl');
  assert(urlOnlyAttributionLead.data.lead?.channel === 'kakao', 'lead channel should follow URL UTM source');

  const duplicateSaved = await json({ baseUrl }, 'POST', '/api/leads', {
    project,
    page,
    lead: { id: 'lead-a-duplicate', type: 'consult', status: 'new', name: 'Alpha Again', phone: '01000000001', clientId: 'client-repeat-a', ipHash: 'ip-smoke-duplicate', createdAt: '2026-05-21T03:00:10.000Z' },
  });
  assert(duplicateSaved.res.ok && duplicateSaved.data.lead?.duplicate, 'duplicate lead should be saved with duplicate metadata');
  assert(String(duplicateSaved.data.lead?.duplicateReason || '').includes('phone_30d'), 'duplicate reason should include phone_30d');

  const clientRepeat = await json({ baseUrl }, 'POST', '/api/leads', {
    project,
    page,
    lead: { id: 'lead-client-repeat', type: 'consult', status: 'new', name: 'Client Repeat', clientId: 'client-repeat-a', ipHash: 'ip-smoke-client', createdAt: '2026-05-21T03:00:20.000Z' },
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
    lead: { id: 'policy-seed', type: 'consult', status: 'new', name: 'Policy Seed', phone: '010-7777-0001', clientId: 'policy-client', ipHash: 'ip-policy', createdAt: '2026-05-21T03:00:00.000Z' },
  });
  assert(policySeed.res.ok, 'policy seed lead should save');
  const policyBlocked = await json({ baseUrl }, 'POST', '/api/leads', {
    project: policyProject,
    page: policyPage,
    lead: { id: 'policy-blocked', type: 'consult', status: 'new', name: 'Policy Blocked', phone: '01077770001', clientId: 'policy-client', ipHash: 'ip-policy', createdAt: '2026-05-21T03:00:04.000Z' },
  });
  assert(policyBlocked.res.status === 429 && policyBlocked.data.code === 'LEAD_RATE_LIMITED', 'settings should block configured duplicate lead');
  assert(['phone_duplicate', 'client_duplicate_limit', 'ip_duplicate_limit'].includes(policyBlocked.data.reason), `unexpected policy block reason: ${policyBlocked.data.reason}`);

  const blockedHistoryQuery = new URLSearchParams({ ...policyProject, month: '2026-05', limit: '20' }).toString();
  const blockedHistory = await json({ baseUrl }, 'GET', `/api/leads/blocked-history?${blockedHistoryQuery}`);
  assert(blockedHistory.res.ok && blockedHistory.data.records?.length >= 1, 'blocked history should expose rate limited submissions');
  assert(blockedHistory.data.records.some((record) => record.reason === policyBlocked.data.reason), 'blocked history should include block reason');

  const policyOffProject = { projectId: 'smoke-leads-policy-off', slug: 'smoke-policy-off' };
  const policyOffPage = {
    ...page,
    slug: policyOffProject.slug,
    leadDuplicateSettings: {
      rejectIpDuplicate: false,
      rejectCookieDuplicate: false,
      formDuplicateLimitCount: 1,
      formDuplicateLimitWindow: '1mo',
      phoneEmailMode: 'mark',
    },
  };
  const policyOffSeed = await json({ baseUrl }, 'POST', '/api/leads', {
    project: policyOffProject,
    page: policyOffPage,
    lead: { id: 'policy-off-seed', type: 'consult', status: 'new', name: 'Policy Off Seed', phone: '010-7777-0101', clientId: 'policy-off-client', ipHash: 'ip-policy-off', createdAt: '2026-05-21T03:10:00.000Z' },
  });
  assert(policyOffSeed.res.ok, 'disabled duplicate policy seed should save');
  const policyOffRepeat = await json({ baseUrl }, 'POST', '/api/leads', {
    project: policyOffProject,
    page: policyOffPage,
    lead: { id: 'policy-off-repeat', type: 'consult', status: 'new', name: 'Policy Off Repeat', phone: '010-7777-0102', clientId: 'policy-off-client', ipHash: 'ip-policy-off', createdAt: '2026-05-21T03:10:04.000Z' },
  });
  assert(policyOffRepeat.res.ok, 'IP and cookie duplicate rejection should stay disabled');
  assert(policyOffRepeat.data.lead?.duplicate, 'disabled rejection should still retain duplicate metadata');
  assert(String(policyOffRepeat.data.lead?.duplicateReason || '').includes('client_repeat_30m'), 'disabled rejection should record the repeat signal');

  const firstPage = await json({ baseUrl }, 'GET', `/api/leads?${query}&limit=2`);
  assert(firstPage.data.leads.length === 2, 'lead first page length mismatch');
  assert(firstPage.data.total === 7 && firstPage.data.hasMore, 'lead pagination meta mismatch');

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
  assert(csv.headers.get('content-disposition')?.includes('leads-2026-05.csv'), 'lead csv filename should use selected month');
  assert(csvText.includes('reservationDate') && csvText.includes('2026-05-22') && csvText.includes('10:30'), 'lead csv reservation columns failed');

  const sourceCsv = await fetchWithTimeout(`${baseUrl}/api/leads/export.csv?${query}&month=2026-05&ids=lead-source`, { headers: authHeaders() });
  const sourceCsvText = await sourceCsv.text();
  assert(sourceCsv.ok, 'source CSV export request failed');
  assert(sourceCsvText.includes('https://external.example/form?utm_source=naver') && sourceCsvText.includes('naver') && sourceCsvText.includes('smoke'), 'source CSV should include URL and UTM fields');
  assert(sourceCsvText.includes('예산') && sourceCsvText.includes('300만원'), 'source CSV should include actual form answer fields');

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

  const channelProject = { projectId: 'smoke-leads-channel-csv', slug: 'smoke-channel-csv' };
  const channelQuery = new URLSearchParams(channelProject).toString();
  const channelPage = { title: 'Channel CSV', slug: channelProject.slug };
  const naverLead = await json({ baseUrl }, 'POST', '/api/leads', {
    project: channelProject,
    page: channelPage,
    lead: {
      id: 'csv-naver',
      type: 'consult',
      status: 'new',
      name: 'CSV Naver',
      phone: '010-7777-0001',
      sourceUrl: 'https://example.com/?utm_source=naver&utm_medium=cpc',
      createdAt: '2026-05-15T03:00:00.000Z',
    },
  });
  assert(naverLead.res.ok, 'channel CSV naver lead save failed');
  const directLead = await json({ baseUrl }, 'POST', '/api/leads', {
    project: channelProject,
    page: channelPage,
    lead: {
      id: 'csv-direct',
      type: 'consult',
      status: 'new',
      name: 'CSV Direct',
      phone: '010-7777-0002',
      sourceUrl: 'https://example.com/direct',
      createdAt: '2026-05-16T03:00:00.000Z',
    },
  });
  assert(directLead.res.ok, 'channel CSV direct lead save failed');
  const channelCsv = await fetchWithTimeout(`${baseUrl}/api/leads/export.csv?${channelQuery}&month=2026-05&channel=naver`, { headers: authHeaders() });
  const channelCsvText = await channelCsv.text();
  assert(channelCsv.ok && channelCsvText.includes('CSV Naver') && !channelCsvText.includes('CSV Direct'), 'channel CSV export should honor selected channel');

  const statsSummary = await json({ baseUrl }, 'GET', `/api/stats/summary?${monthQuery}&month=2026-05&period=thisMonth`);
  assert(statsSummary.res.ok && statsSummary.data.source === 'server', 'stats summary source mismatch');
  assert(statsSummary.data.totals?.leads === 60 && !('filteredLeads' in (statsSummary.data.summary || {})), 'stats summary should aggregate without raw lead arrays');
}, { timeoutMs: 10000 });
