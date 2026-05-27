import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const apiToken = 'smoke-token';
const smokeTimeoutMs = Math.max(10000, Number(process.env.INLET_SMOKE_TIMEOUT_MS || 30000));
const cleanupTasks = [];
let cleanupPromise = null;
let currentStep = 'init';

function addCleanup(task) {
  cleanupTasks.unshift(task);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCleanup() {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    for (const task of cleanupTasks.splice(0)) {
      try {
        await task();
      } catch (error) {
        console.warn(`smoke cleanup skipped: ${String(error?.message || error)}`);
      }
    }
  })();
  return cleanupPromise;
}

async function step(name, task) {
  currentStep = name;
  return task();
}

function authHeaders(headers = {}) {
  return {
    Authorization: `Bearer ${apiToken}`,
    'X-Inlet-Api-Token': apiToken,
    ...(headers || {}),
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function createWebhookReceiver() {
  const received = [];
  const sockets = new Set();
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    received.push({
      method: req.method,
      url: req.url,
      body: raw ? JSON.parse(raw) : null,
    });
    if (req.url?.includes('/slow')) await delay(1000);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        server,
        received,
        url: `http://127.0.0.1:${server.address().port}/hook`,
        slowUrl: `http://127.0.0.1:${server.address().port}/slow`,
        close: () => closeServer(server, sockets),
      });
    });
  });
}

async function closeServer(server, sockets = new Set(), timeoutMs = 1500) {
  if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
  const closed = new Promise((resolve) => server.close(() => resolve(true)));
  const timedOut = delay(timeoutMs).then(() => false);
  const ok = await Promise.race([closed, timedOut]);
  if (ok) return;
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  for (const socket of sockets) socket.destroy();
  await Promise.race([
    closed,
    delay(500),
  ]);
}

async function waitForHealth(baseUrl, deadlineMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}/api/health`, {}, 1000);
      if (res.ok) return;
    } catch {}
    await delay(120);
  }
  throw new Error('server did not become healthy');
}

async function json(baseUrl, method, pathname, body) {
  const res = await fetchWithTimeout(`${baseUrl}${pathname}`, {
    method,
    headers: body ? authHeaders({ 'Content-Type': 'application/json' }) : authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  }, 5000);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return { res, data };
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(2000),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
  }
}

async function main() {
  const port = await freePort();
  const tmpRoot = path.resolve(process.env.INLET_SMOKE_TMP_DIR || path.join(process.cwd(), '.tmp-smoke'));
  await mkdir(tmpRoot, { recursive: true });
  const dataDir = await mkdtemp(path.join(tmpRoot, 'inlet-api-smoke-'));
  addCleanup(() => rm(dataDir, { recursive: true, force: true }));
  const webhook = await createWebhookReceiver();
  addCleanup(() => webhook.close());
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      INLET_API_PORT: String(port),
      INLET_DATA_DIR: dataDir,
      INLET_EVENTS_DEDUPE_MS: '30000',
      INLET_INTEGRATION_TIMEOUT_MS: '250',
      INLET_API_TOKEN: apiToken,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  addCleanup(() => stopChild(child));

  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    await step('wait for health', () => waitForHealth(baseUrl));
    const project = { projectId: 'smoke-project', slug: 'smoke' };
    const query = new URLSearchParams(project).toString();
    const page = {
      title: 'Smoke Page',
      slug: 'smoke',
      integrations: {
        webhook: { enabled: true, url: webhook.url, service: 'custom' },
      },
    };

    const favicon = await step('favicon', () => fetchWithTimeout(`${baseUrl}/favicon.ico`, {}, 5000));
    assert(favicon.status === 204, `favicon expected 204, got ${favicon.status}`);

    const unauthorized = await step('api token guard', () => fetchWithTimeout(`${baseUrl}/api/leads?${query}&limit=1`, {}, 5000));
    assert(unauthorized.status === 401, `api token guard expected 401, got ${unauthorized.status}`);

    const missingPreviewUrl = await step('link preview missing url', () => fetchWithTimeout(`${baseUrl}/api/link-preview`, { headers: authHeaders() }, 5000));
    assert(missingPreviewUrl.status === 400, `link preview missing url expected 400, got ${missingPreviewUrl.status}`);

    const privatePreviewUrl = await step('link preview private url', () => fetchWithTimeout(`${baseUrl}/api/link-preview?url=${encodeURIComponent('http://127.0.0.1/')}`, { headers: authHeaders() }, 5000));
    assert(privatePreviewUrl.status === 400, `link preview private url expected 400, got ${privatePreviewUrl.status}`);

    const leadInputs = [
      { id: 'lead-a', type: 'consult', status: '신규', name: 'Alpha', phone: '010-0000-0001', memo: 'alpha memo' },
      { id: 'lead-b', type: 'reservation', status: '신규', name: 'Beta', phone: '010-0000-0002', memo: 'beta memo', values: { reservationDate: '2026-05-22', reservationTime: '10:30' } },
      { id: 'lead-c', type: 'consult', status: '완료', name: 'Gamma', phone: '010-0000-0003', memo: 'gamma memo' },
    ];

    for (const lead of leadInputs) {
      const { res, data } = await step(`save lead ${lead.id}`, () => json(baseUrl, 'POST', '/api/leads', { project, page, lead }));
      assert(res.ok && data.lead?.id === lead.id, `lead save failed: ${lead.id}`);
    }

    const firstPage = await step('lead first page', () => json(baseUrl, 'GET', `/api/leads?${query}&limit=2`));
    assert(firstPage.data.leads.length === 2, 'lead first page length mismatch');
    assert(firstPage.data.total === 3 && firstPage.data.hasMore, 'lead pagination meta mismatch');

    const secondPage = await step('lead second page', () => json(baseUrl, 'GET', `/api/leads?${query}&limit=2&cursor=${firstPage.data.nextCursor}`));
    assert(secondPage.data.leads.length === 1 && !secondPage.data.hasMore, 'lead second page mismatch');

    const filtered = await step('lead filter', () => json(baseUrl, 'GET', `/api/leads?${query}&kind=reservation&q=beta`));
    assert(filtered.data.total === 1 && filtered.data.leads[0].id === 'lead-b', 'lead server filter mismatch');

    const expectedUpdatedAt = filtered.data.leads[0].updatedAt || filtered.data.leads[0].savedAt || filtered.data.leads[0].createdAt;
    const updated = await step('lead update', () => json(baseUrl, 'PATCH', '/api/leads/lead-b', {
      project,
      patch: { memo: '=updated memo', __expectedUpdatedAt: expectedUpdatedAt },
    }));
    assert(updated.res.ok && updated.data.lead.memo === '=updated memo', 'lead update failed');

    const conflict = await step('lead conflict', () => json(baseUrl, 'PATCH', '/api/leads/lead-b', {
      project,
      patch: { memo: 'stale memo', __expectedUpdatedAt: 'stale-version' },
    }));
    assert(conflict.res.status === 409, `lead conflict expected 409, got ${conflict.res.status}`);

    const csv = await step('lead csv export', () => fetchWithTimeout(`${baseUrl}/api/leads/export.csv?${query}&ids=lead-b`, { headers: authHeaders() }, 5000));
    const csvText = await csv.text();
    assert(csv.ok && csvText.includes('"\'=updated memo"') && !csvText.includes('alpha memo'), 'lead csv ids filter failed');
    assert(csvText.includes('reservationDate') && csvText.includes('2026-05-22') && csvText.includes('10:30'), 'lead csv reservation columns failed');

    await step('seed failed lead', () => json(baseUrl, 'PATCH', '/api/leads/lead-c', {
      project,
      patch: { delivery: { status: 'failed', summary: 'smoke failed', logs: [] } },
    }));
    const retry = await step('retry failed lead', () => json(baseUrl, 'POST', '/api/leads/retry-failed', { project, page }));
    assert(retry.res.ok && retry.data.retried === 1, 'lead retry failed mismatch');
    assert(webhook.received.length >= 1, 'webhook receiver did not get retry delivery');
    assert(webhook.received[0].body?.lead?.id === 'lead-c', 'webhook retry payload lead mismatch');

    const timeoutLead = { id: 'lead-timeout', type: 'consult', status: 'new', name: 'Timeout', phone: '010-0000-0099' };
    await step('save timeout lead', () => json(baseUrl, 'POST', '/api/leads', { project, page, lead: timeoutLead }));
    await step('seed timeout lead', () => json(baseUrl, 'PATCH', '/api/leads/lead-timeout', {
      project,
      patch: { delivery: { status: 'failed', summary: 'timeout seed', logs: [] } },
    }));
    const timeoutRetry = await step('retry slow webhook lead', () => json(baseUrl, 'POST', '/api/leads/retry-failed', {
      project,
      page: {
        ...page,
        integrations: { webhook: { enabled: true, url: webhook.slowUrl, service: 'custom' } },
      },
    }));
    const timeoutResult = timeoutRetry.data.leads.find((lead) => lead.id === 'lead-timeout');
    assert(timeoutRetry.res.ok && timeoutRetry.data.retried === 1, 'lead retry timeout mismatch');
    assert(timeoutResult?.delivery?.status === 'failed', 'slow webhook should fail delivery');
    assert(timeoutResult.delivery.logs?.[0]?.message?.includes('timed out'), 'slow webhook timeout message missing');

    const deleted = await step('lead delete', () => json(baseUrl, 'DELETE', `/api/leads/lead-a?${query}`));
    assert(deleted.res.ok && deleted.data.id === 'lead-a', 'lead delete failed');

    const eventInputs = [
      { id: 'event-a', type: 'page_view', label: 'home', channel: 'direct', device: 'desktop', createdAt: new Date().toISOString() },
      { id: 'event-b', type: 'cta_click', label: 'call', channel: 'direct', device: 'mobile', createdAt: new Date().toISOString() },
      { id: 'event-c', type: 'form_submit', label: 'consult', channel: 'ads', device: 'mobile', createdAt: new Date().toISOString() },
    ];
    for (const event of eventInputs) {
      const { res } = await step(`save event ${event.id}`, () => json(baseUrl, 'POST', '/api/events', { project, event }));
      assert(res.ok, `event save failed: ${event.id}`);
    }
    const duplicateEvent = await step('event dedupe', () => json(baseUrl, 'POST', '/api/events', { project, event: { ...eventInputs[1], id: 'event-b-dup' } }));
    assert(duplicateEvent.data.event?.deduped === true, 'event dedupe failed');

    const eventsPage = await step('event first page', () => json(baseUrl, 'GET', `/api/events?${query}&limit=2`));
    assert(eventsPage.data.events.length === 2 && eventsPage.data.hasMore, 'event pagination first page mismatch');
    const eventsNext = await step('event next page', () => json(baseUrl, 'GET', `/api/events?${query}&limit=2&cursor=${eventsPage.data.nextCursor}`));
    assert(eventsNext.data.events.length === 1 && !eventsNext.data.hasMore, 'event pagination next page mismatch');

    console.log(JSON.stringify({ ok: true, baseUrl, checks: 24 }, null, 2));
  } finally {
    await runCleanup();
    if (child.exitCode && child.exitCode !== 0 && stderr) {
      console.error(stderr);
    }
  }
}

let smokeTimer = null;

try {
  await Promise.race([
    main(),
    new Promise((_, reject) => {
      smokeTimer = setTimeout(async () => {
        await runCleanup();
        reject(new Error(`server api smoke timed out after ${smokeTimeoutMs}ms at step: ${currentStep}`));
      }, smokeTimeoutMs);
    }),
  ]);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (smokeTimer) clearTimeout(smokeTimer);
  await runCleanup();
}
