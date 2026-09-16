import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const origin = String(process.env.INLET_EDITOR_BROWSER_QA_ORIGIN || 'http://127.0.0.1:4174').replace(/\/$/, '');
const screenshotDir = process.env.INLET_EDITOR_BROWSER_QA_SCREENSHOT_DIR || '.tmp-editor-browser-regression';
const debugPort = Number(process.env.INLET_EDITOR_IMAGE_LIBRARY_QA_CHROME_PORT || 9342);
const chromeInput = String(process.env.INLET_EDITOR_BROWSER_QA_CHROME_PATH || '').trim();
const libraryKey = 'editor-project/images/library-image.png';
const libraryFileName = 'library-image.png';
const selectedImageValue = `/api/files/download?key=${encodeURIComponent(libraryKey)}`;
const pixelPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resolveChrome() {
  return [chromeInput, process.env.CHROME_PATH, process.env.GOOGLE_CHROME_BIN,
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
    .filter(Boolean).find((candidate) => existsSync(candidate)) || '';
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function waitForChrome(port) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < 20000) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await wait(250);
    }
  }
  throw new Error(`Chrome debugging endpoint did not start: ${lastError?.message || 'unknown error'}`);
}

function createCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 1;
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(String(event.data));
    if (payload.id && pending.has(payload.id)) {
      const request = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) request.reject(new Error(payload.error.message || 'CDP error'));
      else request.resolve(payload.result || {});
      return;
    }
    if (payload.method) for (const listener of listeners.get(payload.method) || []) listener(payload.params || {});
  });
  socket.addEventListener('close', () => {
    for (const request of pending.values()) request.reject(new Error('CDP socket closed'));
    pending.clear();
  });
  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId++;
      const response = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      return response;
    },
    on(method, listener) { listeners.set(method, [...(listeners.get(method) || []), listener]); },
    async close() { await opened.catch(() => {}); socket.close(); },
  };
}

function createQaUser() {
  return {
    id: 'editor-e2e-user', accountId: 'editor-owner', ownerId: 'editor-owner', workspaceId: 'editor-project', projectId: 'editor-project',
    name: '편집 QA', email: 'editor.qa@example.com', phone: '01012345678', role: 'master', accessMode: 'master', plan: 'QA', status: 'active',
  };
}

function createQaPage() {
  return {
    id: 'editor-e2e-page', projectId: 'editor-project', ownerId: 'editor-owner', ownerEmail: 'editor.qa@example.com',
    title: '편집 E2E 페이지', slug: 'editor-e2e', status: 'published', revision: 3, updatedAt: '2026-09-16T00:00:00.000Z',
    share: { enabled: true, position: 'top-right', display: 'icon' },
    theme: {
      accent: '#2563eb', bgMode: 'solid', bg: '#eef2f7', bgSolid: '#eef2f7', card: '#ffffff', text: '#111827', radius: 22,
      font: 'modern', fontFamily: 'pretendard', globalAlign: 'left', animOn: false, animType: 'fade', buttonEffect: 'fill',
    },
    meta: { title: '', desc: '', favicon: '', og: '' },
    integrations: {
      internal: { enabled: true }, email: { enabled: false, to: '' },
      sheets: { enabled: false, provider: 'google_sheets', mode: 'webhook', status: 'disconnected', webhookUrl: '', url: '' },
    },
    blocks: [
      { id: 'editor-topnav', type: 'topnav', visible: true, s: { logoType: 'text', logoText: 'QA', logoStyle: 'badge', logoSize: 'small', menuStyle: 'pill', menuSize: 'small', bg: 'white', align: 'left', sticky: true, menus: [] } },
      { id: 'editor-hero', type: 'hero', visible: true, s: { anchorId: 'editor-hero', title: '이미지 보관함 E2E', body: '기존 프로젝트 이미지를 다시 선택합니다.', image: '', imageMode: 'top', imageFit: 'contain', imageHeightPx: 260, align: 'left', titleSize: 'large', bodySize: 'medium', height: 'medium' } },
      { id: 'editor-image', type: 'image', visible: true, s: { anchorId: 'editor-image', mode: 'single', image: '', gallery: [], imageDisplay: 'original', imageHeightPx: 260, imageX: 50, imageY: 50, caption: '', alt: '' } },
      { id: 'editor-form', type: 'form', visible: true, s: { anchorId: 'editor-form', title: '상담 신청', desc: '테스트 폼', style: 'card', submit: '신청하기', privacy: '개인정보 수집 및 이용에 동의합니다.', privacyRequired: true, inputStyle: 'round', buttonStyle: 'solid', questions: [{ id: 'editor-name', label: '이름', type: 'name', required: true, options: [] }] } },
      { id: 'editor-bottom', type: 'bottombar', visible: true, s: { count: 1, style: 'pill', color: 'dark', timerEnabled: false, mobileOnly: true, buttons: [{ id: 'editor-bottom-1', enabled: true, icon: '💬', label: '상담', target: 'editor-form', url: '' }] } },
      { id: 'editor-footer', type: 'footer', visible: true, s: { company: '페이지로 QA', owner: 'QA', phone: '010-0000-0000', email: '', address: '', biz: '', align: 'center', bg: 'soft' } },
    ],
  };
}

const jsonBody = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
function parsePostData(value = '') {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

function createApiMock(client) {
  const user = createQaUser();
  const state = {
    currentPage: createQaPage(), loginCount: 0, sessionCount: 0, projectListCount: 0, pageLoadCount: 0,
    publicVerifyCount: 0, saveCount: 0, mediaListCount: 0, mediaListRequests: [], imageDownloadCount: 0,
    unexpectedApis: [], interceptError: null,
  };
  const fulfillJson = (requestId, status, payload) => client.send('Fetch.fulfillRequest', {
    requestId, responseCode: status,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }, { name: 'Cache-Control', value: 'no-cache, no-store' }],
    body: jsonBody(payload),
  });
  const fulfillImage = (requestId) => client.send('Fetch.fulfillRequest', {
    requestId, responseCode: 200,
    responseHeaders: [{ name: 'Content-Type', value: 'image/png' }, { name: 'Cache-Control', value: 'no-cache, no-store' }],
    body: pixelPngBase64,
  });
  const handler = async ({ requestId, request }) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return client.send('Fetch.continueRequest', { requestId });
    const method = String(request.method || 'GET').toUpperCase();
    const pathname = url.pathname;
    const body = parsePostData(request.postData || '');

    if (pathname === '/api/auth/login' && method === 'POST') {
      state.loginCount += 1; await fulfillJson(requestId, 200, { user, session: 'editor-e2e-session' }); return;
    }
    if (pathname === '/api/auth/session' && method === 'POST') {
      state.sessionCount += 1; await fulfillJson(requestId, 200, { user, session: 'editor-e2e-session' }); return;
    }
    if (pathname === '/api/auth/logout' && method === 'POST') { await fulfillJson(requestId, 200, { ok: true }); return; }
    if (pathname === '/api/projects' && method === 'GET') {
      state.projectListCount += 1;
      const page = state.currentPage;
      await fulfillJson(requestId, 200, { pages: [{ id: page.id, projectId: page.projectId, ownerId: page.ownerId, title: page.title, slug: page.slug, status: page.status, revision: page.revision, updatedAt: page.updatedAt, leadCount: 0 }] });
      return;
    }
    if (pathname === '/api/account-page' && method === 'GET') { state.pageLoadCount += 1; await fulfillJson(requestId, 200, { page: state.currentPage }); return; }
    if (pathname === '/api/leads' && method === 'GET') { await fulfillJson(requestId, 200, { leads: [], total: 0, nextCursor: null, hasMore: false }); return; }
    if (pathname === '/api/events' && method === 'GET') { await fulfillJson(requestId, 200, { events: [], total: 0, nextCursor: null, hasMore: false }); return; }
    if (pathname === '/api/stats/summary' && method === 'GET') { await fulfillJson(requestId, 200, { summary: null, leads: [], events: [] }); return; }
    if (pathname === '/api/files/list' && method === 'GET') {
      state.mediaListCount += 1;
      state.mediaListRequests.push(Object.fromEntries(url.searchParams.entries()));
      await fulfillJson(requestId, 200, {
        ok: true, kind: 'image', hasMore: false, cursor: '',
        assets: [{ key: libraryKey, kind: 'image', fileName: libraryFileName, size: 68, uploadedAt: '2026-09-16T00:00:00.000Z', contentType: 'image/png', purpose: 'page-image', downloadUrl: `${origin}${selectedImageValue}` }],
      });
      return;
    }
    if (pathname === '/api/files/download' && method === 'GET') {
      if (url.searchParams.get('key') !== libraryKey) {
        state.unexpectedApis.push(`${method} ${pathname}?key=${url.searchParams.get('key') || ''}`);
        await fulfillJson(requestId, 404, { error: 'unexpected image key' });
        return;
      }
      state.imageDownloadCount += 1; await fulfillImage(requestId); return;
    }
    const pageMatch = pathname.match(/^\/api\/pages\/([^/]+)$/);
    if (pageMatch) {
      const slug = decodeURIComponent(pageMatch[1]);
      if (method === 'GET') {
        if (slug !== state.currentPage.slug) { await fulfillJson(requestId, 404, { error: 'not found', code: 'PAGE_NOT_FOUND' }); return; }
        if (url.searchParams.get('public') === '1') state.publicVerifyCount += 1; else state.pageLoadCount += 1;
        await fulfillJson(requestId, 200, { page: state.currentPage }); return;
      }
      if (method === 'POST' && slug === state.currentPage.slug) {
        state.saveCount += 1;
        state.currentPage = { ...(body.page || {}), id: state.currentPage.id, projectId: state.currentPage.projectId, ownerId: state.currentPage.ownerId, slug: state.currentPage.slug, status: 'published', revision: Number(state.currentPage.revision || 0) + 1, updatedAt: `2026-09-16T00:${String(state.saveCount).padStart(2, '0')}:00.000Z` };
        await fulfillJson(requestId, 200, { ok: true, page: state.currentPage, saveMode: body.saveMode || '', saveRequestId: body.saveRequestId || '' }); return;
      }
    }
    if (/^\/api\/pages\/[^/]+\/revisions/.test(pathname) && method === 'GET') { await fulfillJson(requestId, 200, { revisions: [] }); return; }
    state.unexpectedApis.push(`${method} ${pathname}`);
    await fulfillJson(requestId, 404, { error: 'unexpected image library browser QA API request', method, pathname });
  };
  client.on('Fetch.requestPaused', (params) => handler(params).catch((error) => {
    state.interceptError = error;
    client.send('Fetch.failRequest', { requestId: params.requestId, errorReason: 'Failed' }).catch(() => {});
  }));
  return state;
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'Browser evaluation failed');
  return response.result?.value;
}
async function waitForBrowser(client, expression, label, timeoutMs = 18000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await evaluate(client, expression);
    if (last) return last;
    await wait(200);
  }
  throw new Error(`${label} did not become ready: ${JSON.stringify(last)}`);
}
async function waitForState(check, label, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) { if (check()) return; await wait(100); }
  throw new Error(`${label} did not complete`);
}
async function setInputValue(client, selector, value) {
  const result = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false;
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
    return element.value === ${JSON.stringify(value)};
  })()`);
  assert(result, `Unable to set input value for ${selector}`);
}
async function clickSelector(client, selector) {
  const clicked = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false;
    element.scrollIntoView({ block: 'center', inline: 'center' }); element.click(); return true;
  })()`);
  assert(clicked, `Unable to click ${selector}`);
}
async function capture(client, name) {
  const image = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  const target = path.join(screenshotDir, `${name}.png`);
  await writeFile(target, Buffer.from(image.data, 'base64'));
  return target;
}

async function run() {
  const chrome = resolveChrome();
  assert(chrome, 'Chrome or Chromium executable was not found');
  await mkdir(screenshotDir, { recursive: true });
  const profileDir = await mkdtemp(path.join(tmpdir(), 'inlet-editor-image-library-'));
  const browserErrors = [];
  let child = null;
  let client = null;
  try {
    child = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox', '--hide-scrollbars', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr?.on('data', () => {});
    await waitForChrome(debugPort);
    const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
    const target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
    assert(target, 'Chrome page target was not found');
    client = createCdp(target.webSocketDebuggerUrl);
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => browserErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || 'Browser exception'));
    await client.send('Page.enable'); await client.send('Runtime.enable'); await client.send('Network.enable');
    await client.send('Fetch.enable', { patterns: [{ urlPattern: '*://*/*', requestStage: 'Request' }] });
    const apiState = createApiMock(client);

    await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, screenWidth: 1280, screenHeight: 900, deviceScaleFactor: 1, mobile: false });
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await client.send('Page.navigate', { url: `${origin}/login` });
    await waitForBrowser(client, `!!document.querySelector('.auth-card')`, 'login screen');
    await setInputValue(client, 'input[placeholder="email@example.com"]', createQaUser().email);
    await setInputValue(client, 'input[type="password"]', 'Editor1234');
    await clickSelector(client, '.auth-form button[type="submit"]');

    await waitForBrowser(client, `!!document.querySelector('.service-dashboard') && (document.body?.innerText || '').includes('편집 E2E 페이지')`, 'dashboard page list');
    const opened = await evaluate(client, `(() => {
      const card = [...document.querySelectorAll('.service-landing-card')].find((item) => (item.innerText || '').includes('편집 E2E 페이지'));
      const button = card && [...card.querySelectorAll('button')].find((item) => item.textContent.trim() === '편집');
      if (!button) return false; button.click(); return true;
    })()`);
    assert(opened, 'dashboard editor button was not found');

    await waitForBrowser(client, `!!document.querySelector('.builder-shell:not(.mobile-operations-shell)') && !!document.querySelector('#editor-block-editor-image')`, 'desktop editor with image block');
    await clickSelector(client, '#editor-block-editor-image .screen-order-v2-head');
    await waitForBrowser(client, `!!document.querySelector('.screen-order-v2-settings-panel .image-input-library-action')`, 'image block library action');
    assert(apiState.saveCount === 0, 'opening the image editor must not publish the page');
    await capture(client, 'desktop-image-library-before');

    await clickSelector(client, '.screen-order-v2-settings-panel .image-input-library-action');
    await waitForState(() => apiState.mediaListCount === 1, 'project image list request');
    await waitForBrowser(client, `!!document.querySelector('.image-library-picker[role="dialog"]') && !!document.querySelector('.image-library-picker-item[title="${libraryFileName}"]')`, 'image library dialog');
    const mediaRequest = apiState.mediaListRequests[0] || {};
    assert(mediaRequest.projectId === 'editor-project', `image library project scope changed: ${JSON.stringify(mediaRequest)}`);
    assert(mediaRequest.ownerId === 'editor-owner', `image library owner scope changed: ${JSON.stringify(mediaRequest)}`);
    assert(mediaRequest.slug === 'editor-e2e', `image library slug scope changed: ${JSON.stringify(mediaRequest)}`);
    assert(mediaRequest.kind === 'image', `image library must request image assets only: ${JSON.stringify(mediaRequest)}`);

    await clickSelector(client, `.image-library-picker-item[title="${libraryFileName}"]`);
    await waitForBrowser(client, `!document.querySelector('.image-library-picker[role="dialog"]')`, 'image library dialog close');
    await waitForBrowser(client, `(() => { const image = document.querySelector('.screen-order-v2-settings-panel .image-preview-control.has-image img'); return !!image && image.src.includes(${JSON.stringify(encodeURIComponent(libraryKey))}); })()`, 'selected image preview');
    await waitForBrowser(client, `(document.body?.innerText || '').includes('내 이미지에서 선택 완료')`, 'image selection success feedback');
    await capture(client, 'desktop-image-library-selected');

    await wait(1100);
    assert(apiState.saveCount === 0, 'selecting an existing image must remain local until explicit publish');
    await clickSelector(client, '.panel-actions .primary-btn');
    await waitForState(() => apiState.saveCount === 1 && apiState.publicVerifyCount >= 1, 'image selection publish and public verification');
    const savedImageBlock = apiState.currentPage.blocks.find((block) => block.id === 'editor-image');
    assert(savedImageBlock?.s?.image === selectedImageValue, `published image block mismatch: ${savedImageBlock?.s?.image || ''}`);

    await client.send('Page.reload', { ignoreCache: true });
    await waitForBrowser(client, `!!document.querySelector('.builder-shell:not(.mobile-operations-shell)') && !!document.querySelector('#editor-block-editor-image')`, 'reloaded editor');
    await clickSelector(client, '#editor-block-editor-image .screen-order-v2-head');
    await waitForBrowser(client, `(() => { const image = document.querySelector('.screen-order-v2-settings-panel .image-preview-control.has-image img'); return !!image && image.src.includes(${JSON.stringify(encodeURIComponent(libraryKey))}); })()`, 'selected image after reload');
    await capture(client, 'desktop-image-library-reloaded');

    assert(apiState.loginCount === 1, `login API must run exactly once: ${apiState.loginCount}`);
    assert(apiState.sessionCount >= 1, 'saved login session was not refreshed after reload');
    assert(apiState.projectListCount >= 1, 'dashboard project list API did not run');
    assert(apiState.mediaListCount === 1, `image library list should load once for one open: ${apiState.mediaListCount}`);
    assert(apiState.imageDownloadCount >= 1, 'selected project image was never requested for preview');
    assert(!apiState.interceptError, `API interception failed: ${apiState.interceptError?.message || apiState.interceptError}`);
    assert(apiState.unexpectedApis.length === 0, `Unexpected API requests: ${apiState.unexpectedApis.join(', ')}`);
    assert(browserErrors.length === 0, `Browser exceptions: ${browserErrors.join('\n')}`);

    console.log(JSON.stringify({
      ok: true,
      scope: 'editor-project-image-library-browser-e2e',
      flow: ['login', 'page-select', 'open-image-block', 'open-library', 'list-project-images', 'select-image', 'local-draft', 'publish', 'reload'],
      mediaListCount: apiState.mediaListCount, mediaRequest, selectedImageValue, saveCount: apiState.saveCount,
      publicVerifyCount: apiState.publicVerifyCount, sessionCount: apiState.sessionCount, imageDownloadCount: apiState.imageDownloadCount, screenshots: 3,
    }, null, 2));
  } finally {
    await client?.close().catch(() => {});
    if (child && !child.killed) child.kill('SIGTERM');
    await rm(profileDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
}

await run();
