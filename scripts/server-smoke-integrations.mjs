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
        sheets: { enabled: true, url: webhook.url, sheetName: 'Smoke Leads' },
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
    assert(webhook.received.every((item) => item.body?.schemaVersion === 'inlet.lead.v1' || item.body?.target === 'webhook'), 'payload schema marker missing');

    const deliveryLogs = await json({ baseUrl }, 'GET', `/api/leads/delivery-logs?${new URLSearchParams(project).toString()}&leadId=${lead.id}`);
    assert(deliveryLogs.res.ok && deliveryLogs.data.total >= 1, 'delivery logs API failed');
    assert(deliveryLogs.data.logs[0]?.leadId === lead.id, 'delivery logs lead filter failed');
    assert(deliveryLogs.data.logs[0]?.idempotencyKey, 'delivery logs idempotency key missing');
    assert(deliveryLogs.data.queryPlan?.fullScan === true && deliveryLogs.data.queryPlan?.type === 'delivery-logs', 'delivery logs queryPlan missing');
    assert(deliveryLogs.data.queryPlan?.recommendedIndex && Array.isArray(deliveryLogs.data.queryPlan?.activeIndexFields), 'delivery logs index migration plan missing');
    assert(deliveryLogs.data.queryPlan?.indexKey === deliveryLogs.data.queryPlan?.recommendedIndex && deliveryLogs.data.queryPlan?.migrationPriority, 'delivery logs migration priority missing');

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
