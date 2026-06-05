import { assert, createWebhookReceiver, json, runSmoke } from './lib/serverSmokeHarness.mjs';

await runSmoke('server-smoke-integrations', async ({ baseUrl }) => {
  const webhook = await createWebhookReceiver();
  try {
    const project = { projectId: 'smoke-integrations', slug: 'smoke-integrations' };
    const page = {
      title: 'Smoke Integrations',
      slug: 'smoke-integrations',
      integrations: {
        webhook: { enabled: true, url: webhook.url, service: 'custom' },
        automation: { enabled: true, url: webhook.url, service: 'make' },
        sheets: { enabled: true, provider: 'google_sheets', mode: 'webhook', webhookUrl: webhook.url, spreadsheetId: 'sheet-smoke', sheetName: 'Smoke Leads', connectedEmail: 'owner@example.test', status: 'connected' },
      },
    };

    const lead = { id: 'lead-webhook', type: 'consult', status: 'new', name: 'Webhook' };
    const saved = await json({ baseUrl }, 'POST', '/api/leads', { project, page, lead });
    assert(saved.res.ok && saved.data.lead?.id === lead.id, 'webhook lead save failed');

    const seeded = await json({ baseUrl }, 'PATCH', `/api/leads/${lead.id}`, {
      project,
      patch: { delivery: { status: 'failed', summary: 'smoke failed', logs: [] } },
    });
    assert(seeded.res.ok, 'failed lead seed failed');

    const retry = await json({ baseUrl }, 'POST', '/api/leads/retry-failed', { project, page });
    assert(retry.res.ok && retry.data.retried === 1, 'webhook retry failed');
    assert(webhook.received.length >= 3, 'webhook receiver did not receive webhook/automation/sheets payloads');
    assert(webhook.received[0].body?.lead?.id === lead.id, 'webhook payload lead mismatch');
    assert(webhook.received[0].body?.idempotencyKey, 'webhook idempotency key missing');
    assert(webhook.received.some((item) => item.body?.target === 'automation' && item.body?.service === 'make'), 'Make payload missing');
    assert(webhook.received.some((item) => item.body?.target === 'google_sheets' && item.body?.sheetName === 'Smoke Leads'), 'Google Sheets payload missing');
    assert(webhook.received.some((item) => item.body?.target === 'google_sheets' && item.body?.provider === 'google_sheets' && item.body?.mode === 'webhook'), 'Google Sheets provider/mode missing');
    assert(webhook.received.some((item) => item.body?.target === 'google_sheets' && item.body?.spreadsheetId === 'sheet-smoke' && item.body?.connectedEmail === 'owner@example.test' && item.body?.integration?.status === 'connected'), 'Google Sheets OAuth-ready metadata missing');
    assert(webhook.received.some((item) => item.body?.target === 'google_sheets' && item.body?.lead?.id === lead.id && item.body?.page?.slug === page.slug && item.body?.project), 'Google Sheets structured lead/page/project payload missing');
    assert(webhook.received.every((item) => item.body?.schemaVersion === 'pagero.lead.v1'), 'payload schema marker missing');

    const oauthProject = { projectId: 'smoke-integrations-oauth', slug: 'smoke-integrations-oauth' };
    const oauthPage = {
      title: 'Smoke OAuth Sheets',
      slug: oauthProject.slug,
      integrations: {
        sheets: { enabled: true, provider: 'google_sheets', mode: 'oauth', spreadsheetId: 'sheet-oauth-smoke', sheetName: 'OAuth Leads', connectedEmail: 'owner@example.test', status: 'connected' },
      },
    };
    const oauthSaved = await json({ baseUrl }, 'POST', '/api/leads', {
      project: oauthProject,
      page: oauthPage,
      lead: { id: 'lead-google-oauth', type: 'consult', status: 'new', name: 'OAuth Sheets' },
    });
    assert(oauthSaved.res.ok && oauthSaved.data.lead?.id === 'lead-google-oauth', 'Google Sheets OAuth lead save failed');
    assert(oauthSaved.data.delivery?.logs?.some((log) => log.provider === 'google_sheets'), 'Google Sheets OAuth delivery log should be created');
    assert(!webhook.received.some((item) => item.body?.lead?.id === 'lead-google-oauth'), 'Google Sheets OAuth mode should not fall back to webhook POST');

    const deliveryLogs = await json({ baseUrl }, 'GET', `/api/leads/delivery-logs?${new URLSearchParams(project).toString()}&leadId=${lead.id}`);
    assert(deliveryLogs.res.ok && deliveryLogs.data.total >= 1, 'delivery logs API failed');
    assert(deliveryLogs.data.logs[0]?.leadId === lead.id, 'delivery logs lead filter failed');
    assert(deliveryLogs.data.logs[0]?.idempotencyKey, 'delivery logs idempotency key missing');
    assert(deliveryLogs.data.queryPlan?.fullScan === true && deliveryLogs.data.queryPlan?.type === 'delivery-logs', 'delivery logs queryPlan missing');
    assert(deliveryLogs.data.queryPlan?.recommendedIndex && Array.isArray(deliveryLogs.data.queryPlan?.activeIndexFields), 'delivery logs index migration plan missing');
    assert(deliveryLogs.data.queryPlan?.indexKey === deliveryLogs.data.queryPlan?.recommendedIndex && deliveryLogs.data.queryPlan?.migrationPriority, 'delivery logs migration priority missing');

    const partialLead = { id: 'lead-partial-retry', type: 'consult', status: 'new', name: 'Partial Retry' };
    await json({ baseUrl }, 'POST', '/api/leads', { project, page, lead: partialLead });
    await json({ baseUrl }, 'PATCH', `/api/leads/${partialLead.id}`, {
      project,
      patch: {
        delivery: {
          status: 'partial',
          summary: 'partial seed',
          logs: [
            { provider: 'google_sheets', target: 'Google Sheets', status: 'success', message: 'sent' },
            { provider: 'webhook', target: 'Webhook', status: 'failed', message: 'failed' },
          ],
        },
      },
    });
    const beforePartialRetry = webhook.received.length;
    const partialRetry = await json({ baseUrl }, 'POST', `/api/leads/${partialLead.id}/deliver`, { project, page });
    assert(partialRetry.res.ok && partialRetry.data.delivery?.status === 'success', 'partial provider retry should recover to success');
    assert(webhook.received.length === beforePartialRetry + 1, 'partial provider retry should resend only the failed provider');
    assert(webhook.received.at(-1)?.body?.target === 'webhook', 'partial provider retry should not duplicate Google Sheets rows');

    const compactDryRun = await json({ baseUrl }, 'POST', '/api/leads/compact', { project, dryRun: true });
    assert(compactDryRun.res.ok && compactDryRun.data.dryRun === true, 'lead compact dry-run failed');

    const slowLead = { id: 'lead-slow', type: 'consult', status: 'new', name: 'Slow' };
    await json({ baseUrl }, 'POST', '/api/leads', { project, page, lead: slowLead });
    await json({ baseUrl }, 'PATCH', `/api/leads/${slowLead.id}`, {
      project,
      patch: { delivery: { status: 'failed', summary: 'slow seed', logs: [] } },
    });
    const slowRetry = await json({ baseUrl }, 'POST', '/api/leads/retry-failed', {
      project,
      page: {
        ...page,
        integrations: { webhook: { enabled: true, url: webhook.slowUrl, service: 'custom' } },
      },
    });
    const slowResult = slowRetry.data.leads.find((item) => item.id === slowLead.id);
    assert(slowRetry.res.ok && slowRetry.data.retried === 1, 'slow webhook retry mismatch');
    assert(slowRetry.data.failed === 1 && slowRetry.data.queue?.retryable >= 1, 'retry summary observability missing');
    assert(slowResult?.delivery?.status === 'failed', 'slow webhook should remain failed');
    assert(slowResult.delivery.retry?.attempts === 1, 'manual retry attempt metadata missing');
    assert(slowResult.delivery.logs?.[0]?.message?.includes('timed out'), 'slow webhook timeout message missing');

    const retryQueue = await json({ baseUrl }, 'GET', `/api/leads/retry-queue?${new URLSearchParams(project).toString()}`);
    assert(retryQueue.res.ok && retryQueue.data.total >= 1 && retryQueue.data.retryable >= 1, 'retry queue API failed');
    assert(retryQueue.data.entries.some((entry) => entry.leadId === slowLead.id && entry.canRetry), 'retry queue entry missing');
    assert(retryQueue.data.queryPlan?.fullScan === true && retryQueue.data.queryPlan?.type === 'delivery-retry-queue', 'retry queue queryPlan missing');
    assert(retryQueue.data.queryPlan?.recommendedIndex && Array.isArray(retryQueue.data.queryPlan?.missingIndexFields), 'retry queue index migration plan missing');
    assert(retryQueue.data.queryPlan?.migrationPriority === 'high', 'retry queue migration priority should be high');

    const cachedRetryQueue = await json({ baseUrl }, 'GET', `/api/leads/retry-queue?${new URLSearchParams(project).toString()}`);
    assert(cachedRetryQueue.res.ok && cachedRetryQueue.data.queryPlan?.cacheHit === true, 'retry queue should reuse JSONL read cache on repeated query');
  } finally {
    await webhook.close();
  }
}, { timeoutMs: 7000 });
