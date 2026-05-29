import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readdir, rm, rmdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

export const apiToken = 'smoke-token';

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function authHeaders(headers = {}) {
  return {
    Authorization: `Bearer ${apiToken}`,
    'X-Inlet-Api-Token': apiToken,
    'X-Inlet-Owner-Id': 'local-user',
    ...(headers || {}),
  };
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function json(ctx, method, pathname, body, timeoutMs = 5000) {
  const res = await fetchWithTimeout(`${ctx.baseUrl}${pathname}`, {
    method,
    headers: body ? authHeaders({ 'Content-Type': 'application/json' }) : authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  }, timeoutMs);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return { res, data };
}

export async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

export async function closeServer(server, sockets = new Set(), timeoutMs = 1000) {
  if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
  const closed = new Promise((resolve) => server.close(() => resolve(true)));
  const ok = await Promise.race([closed, delay(timeoutMs).then(() => false)]);
  if (ok) return;
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  for (const socket of sockets) socket.destroy();
  await Promise.race([closed, delay(300)]);
}

export function createWebhookReceiver() {
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

async function waitForHealth(baseUrl, deadlineMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}/api/health`, {}, 800);
      if (res.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error('server did not become healthy');
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(1200),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}

export async function withServer(task, options = {}) {
  const port = await freePort();
  const tmpRoot = path.resolve(process.env.INLET_SMOKE_TMP_DIR || path.join(process.cwd(), '.tmp-smoke'));
  await mkdir(tmpRoot, { recursive: true });
  const dataDir = await mkdtemp(path.join(tmpRoot, `${options.name || 'server-smoke'}-`));
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
      INLET_AUTH_EMAIL_MODE: 'mock',
      INLET_EMAIL_PROVIDER: 'mock',
      ...(options.env || {}),
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    await waitForHealth(baseUrl);
    return await task({ baseUrl, dataDir });
  } finally {
    await stopChild(child);
    await rm(dataDir, { recursive: true, force: true }).catch(() => {});
    const leftover = await readdir(tmpRoot).catch(() => []);
    if (!leftover.length) await rmdir(tmpRoot).catch(() => {});
    if (child.exitCode && child.exitCode !== 0 && stderr) console.error(stderr);
  }
}

export async function runSmoke(name, task, options = {}) {
  const timeoutMs = Math.max(1000, Number(process.env.INLET_SMOKE_TIMEOUT_MS || options.timeoutMs || 5000));
  let timer = null;
  try {
    await Promise.race([
      withServer(task, { ...options, name }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    console.log(JSON.stringify({ ok: true, smoke: name }, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
