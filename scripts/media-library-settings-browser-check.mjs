import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const origin = String(process.env.INLET_EDITOR_BROWSER_QA_ORIGIN || 'http://127.0.0.1:4174').replace(/\/$/, '');
const screenshotDir = process.env.INLET_EDITOR_BROWSER_QA_SCREENSHOT_DIR || '.tmp-editor-browser-regression';
const debugPort = Number(process.env.INLET_MEDIA_SETTINGS_QA_CHROME_PORT || 9344);
const chromeInput = String(process.env.INLET_EDITOR_BROWSER_QA_CHROME_PATH || '').trim();
const activeImageKey = 'editor-project/images/active-image.png';
const revisionImageKey = 'editor-project/images/revision-image.png';
const activeImageValue = `/api/files/download?key=${encodeURIComponent(activeImageKey)}`;
const revisionImageValue = `/api/files/download?key=${encodeURIComponent(revisionImageKey)}`;
const videoKey = 'editor-project/media/2026-09-18/clip.mp4';
const videoDataUrl = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb20=';
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
      { id: 'editor-hero', type: 'hero', visible: true, s: { anchorId: 'editor-hero', title: '미디어 보관함 설정 E2E', body: '검색, 필터, 더보기, 삭제 보호를 검증합니다.', image: '', imageMode: 'top', imageFit: 'contain', imageHeightPx: 260, align: 'left', titleSize: 'large', bodySize: 'medium', height: 'medium' } },
      { id: 'editor-image', type: 'image', visible: true, s: { anchorId: 'editor-image', mode: 'single', image: activeImageValue, gallery: [], imageDisplay: 'original', imageHeightPx: 260, imageX: 50, imageY: 50, caption: '', alt: '' } },
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
    failInitialImageList: true, deleteRequests: [], unexpectedApis: [], interceptError: null,
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

    if (pathname === '/api/auth/login' && method === 'POST') { state.loginCount += 1; await fulfillJson(requestId, 200, { user, session: 'editor-e2e-session' }); return; }
    if (pathname === '/api/auth/session' && method === 'POST') { state.sessionCount += 1; await fulfillJson(requestId, 200, { user, session: 'editor-e2e-session' }); return; }
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
      const params = Object.fromEntries(url.searchParams.entries());
      state.mediaListRequests.push(params);
      const kind = params.kind === 'video' ? 'video' : 'image';
      if (kind === 'image' && !params.cursor && state.failInitialImageList) {
        state.failInitialImageList = false;
        await fulfillJson(requestId, 503, { message: '일시적으로 이미지 목록을 불러오지 못했습니다.' });
        return;
      }
      if (kind === 'video') {
        await fulfillJson(requestId, 200, {
          ok: true, kind: 'video', hasMore: false, cursor: '',
          assets: [{ key: videoKey, kind: 'video', fileName: 'clip.mp4', size: 320000, uploadedAt: '2026-09-18T01:00:00.000Z', contentType: 'video/mp4', purpose: 'media', downloadUrl: videoDataUrl }],
        });
        return;
      }
      if (params.cursor === 'image-next') {
        await fulfillJson(requestId, 200, {
          ok: true, kind: 'image', hasMore: false, cursor: '',
          assets: [
            { key: activeImageKey, kind: 'image', fileName: 'active-image.png', size: 68, uploadedAt: '2026-09-18T03:00:00.000Z', contentType: 'image/png', purpose: 'page-image', downloadUrl: `${origin}${activeImageValue}` },
            { key: revisionImageKey, kind: 'image', fileName: 'revision-image.png', size: 68, uploadedAt: '2026-09-18T02:00:00.000Z', contentType: 'image/png', purpose: 'page-image', downloadUrl: `${origin}${revisionImageValue}` },
          ],
        });
        return;
      }
      await fulfillJson(requestId, 200, {
        ok: true, kind: 'image', hasMore: true, cursor: 'image-next',
        assets: [{ key: activeImageKey, kind: 'image', fileName: 'active-image.png', size: 68, uploadedAt: '2026-09-18T03:00:00.000Z', contentType: 'image/png', purpose: 'page-image', downloadUrl: `${origin}${activeImageValue}` }],
      });
      return;
    }
    if (pathname === '/api/files/download' && method === 'GET') {
      const key = url.searchParams.get('key') || '';
      if (![activeImageKey, revisionImageKey].includes(key)) {
        state.unexpectedApis.push(`${method} ${pathname}?key=${key}`);
        await fulfillJson(requestId, 404, { error: 'unexpected image key' });
        return;
      }
      state.imageDownloadCount += 1;
      await fulfillImage(requestId);
      return;
    }
    if (pathname === '/api/files/delete' && method === 'DELETE') {
      state.deleteRequests.push(body);
      if (body.key === revisionImageKey && body.allowRevisionReferences !== true) {
        await fulfillJson(requestId, 409, {
          code: 'ASSET_REVISION_REFERENCED',
          message: '과거 버전에서 참조 중입니다.',
        });
        return;
      }
      if (body.key === revisionImageKey && body.allowRevisionReferences === true) {
        await fulfillJson(requestId, 200, { ok: true, key: revisionImageKey });
        return;
      }
      await fulfillJson(requestId, 409, { code: 'ASSET_IN_USE', message: '사용 중인 미디어입니다.' });
      return;
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
async function clickButtonByText(client, scopeSelector, text) {
  const clicked = await evaluate(client, `(() => {
    const scope = document.querySelector(${JSON.stringify(scopeSelector)}) || document;
    const button = [...scope.querySelectorAll('button')].find((item) => item.textContent.trim() === ${JSON.stringify(text)});
    if (!button) return false;
    button.scrollIntoView({ block: 'center', inline: 'center' });
    button.click();
    return true;
  })()`);
  assert(clicked, `Unable to click button "${text}" in ${scopeSelector}`);
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

    await waitForBrowser(client, `!!document.querySelector('.top-tabs')`, 'desktop workspace tabs');
    await clickButtonByText(client, '.top-tabs', '설정');
    await waitForBrowser(client, `!!document.querySelector('.settings-v3-root')`, 'settings root');
    await clickButtonByText(client, '.settings-v3-sidebar', '미디어 보관함');
    await waitForBrowser(client, `!!document.querySelector('.media-library-settings')`, 'media library settings');

    await waitForBrowser(client, `!!document.querySelector('.media-library-state.is-error')`, 'initial media load error');
    assert((await evaluate(client, `document.querySelector('.media-library-state.is-error')?.innerText.includes('일시적으로 이미지 목록을 불러오지 못했습니다.')`)), 'media error reason must be visible');
    await clickButtonByText(client, '.media-library-state.is-error', '다시 시도');
    await waitForBrowser(client, `(() => {
      const text = document.querySelector('.media-library-filters')?.innerText || '';
      return text.includes('전체 2+') && text.includes('이미지 1+') && text.includes('영상 1');
    })()`, 'honest paginated media counts');

    const activeProtection = await evaluate(client, `(() => {
      const card = [...document.querySelectorAll('.media-library-card')].find((item) => (item.innerText || '').includes('active-image.png'));
      if (!card) return null;
      const button = [...card.querySelectorAll('button')].find((item) => item.textContent.trim() === '사용 중');
      return {
        note: (card.innerText || '').includes('현재 페이지에서 사용 중'),
        disabled: !!button?.disabled,
      };
    })()`);
    assert(activeProtection?.note && activeProtection?.disabled, 'current-page media must visibly block deletion');

    await setInputValue(client, '.media-library-search input', 'clip.mp4');
    await waitForBrowser(client, `(() => {
      const cards = [...document.querySelectorAll('.media-library-card')].filter((item) => getComputedStyle(item).display !== 'none');
      return cards.length === 1 && (cards[0].innerText || '').includes('clip.mp4');
    })()`, 'media search result');
    await clickButtonByText(client, '.media-library-filters', '영상 1');
    await waitForBrowser(client, `document.querySelectorAll('.media-library-card').length === 1 && (document.querySelector('.media-library-card')?.innerText || '').includes('clip.mp4')`, 'video filter');

    await setInputValue(client, '.media-library-search input', '');
    await clickButtonByText(client, '.media-library-filters', '이미지 1+');
    await waitForBrowser(client, `!![...document.querySelectorAll('.media-library-load-more button')].find((item) => item.textContent.trim() === '이미지 더 불러오기')`, 'image pagination action');
    await clickButtonByText(client, '.media-library-load-more', '이미지 더 불러오기');
    await waitForBrowser(client, `(() => {
      const text = document.querySelector('.media-library-filters')?.innerText || '';
      return text.includes('전체 3') && text.includes('이미지 2') && !text.includes('이미지 2+');
    })()`, 'media counts after pagination');
    assert((await evaluate(client, `[...document.querySelectorAll('.media-library-card')].filter((item) => (item.innerText || '').includes('active-image.png')).length`)) === 1, 'pagination must deduplicate repeated assets');
    await waitForBrowser(client, `[...document.querySelectorAll('.media-library-card')].some((item) => (item.innerText || '').includes('revision-image.png'))`, 'revision image card');

    await evaluate(client, `window.__mediaConfirmMessages = []; window.confirm = (message) => { window.__mediaConfirmMessages.push(String(message)); return true; };`);
    const revisionDeleteClicked = await evaluate(client, `(() => {
      const card = [...document.querySelectorAll('.media-library-card')].find((item) => (item.innerText || '').includes('revision-image.png'));
      const button = card && [...card.querySelectorAll('button')].find((item) => item.textContent.trim() === '삭제');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert(revisionDeleteClicked, 'revision-only media delete button was not found');
    await waitForState(() => apiState.deleteRequests.length === 2, 'revision delete double confirmation requests');
    assert(apiState.deleteRequests[0]?.allowRevisionReferences === false, 'first delete request must not bypass revision safety');
    assert(apiState.deleteRequests[1]?.allowRevisionReferences === true, 'second delete request must explicitly allow revision references');
    await waitForBrowser(client, `![...document.querySelectorAll('.media-library-card')].some((item) => (item.innerText || '').includes('revision-image.png'))`, 'deleted revision media removed');
    const confirmMessages = await evaluate(client, 'window.__mediaConfirmMessages || []');
    assert(confirmMessages.length === 2 && confirmMessages.some((message) => message.includes('과거 버전 기록')), 'revision-only deletion must show a second explicit warning');

    await client.send('Emulation.setDeviceMetricsOverride', { width: 980, height: 900, screenWidth: 980, screenHeight: 900, deviceScaleFactor: 1, mobile: false });
    await wait(350);
    const narrow = await evaluate(client, `(() => {
      const root = document.querySelector('.media-library-settings');
      const controls = document.querySelector('.media-library-controls');
      const rect = root?.getBoundingClientRect();
      return {
        body: document.body?.scrollWidth || 0,
        doc: document.documentElement?.scrollWidth || 0,
        width: innerWidth,
        left: rect?.left || 0,
        right: rect?.right || 0,
        columns: controls ? getComputedStyle(controls).gridTemplateColumns : '',
      };
    })()`);
    assert(narrow.body <= 983 && narrow.doc <= 983, `narrow media settings overflow: ${JSON.stringify(narrow)}`);
    assert(narrow.left >= -2 && narrow.right <= 982, `narrow media settings escaped viewport: ${JSON.stringify(narrow)}`);
    assert(!String(narrow.columns).trim().includes(' '), `narrow media controls must stack to one column: ${narrow.columns}`);
    await capture(client, 'media-settings-narrow-980');

    assert(apiState.mediaListRequests.some((item) => item.kind === 'image' && item.cursor === 'image-next'), 'image pagination cursor was not requested');
    assert(apiState.mediaListRequests.filter((item) => item.kind === 'video').length >= 2, 'media retry must reload the video list with the image list');
    assert(apiState.imageDownloadCount >= 1, 'media image previews were never requested');
    assert(!apiState.interceptError, `API interception failed: ${apiState.interceptError?.message || apiState.interceptError}`);
    assert(apiState.unexpectedApis.length === 0, `Unexpected API requests: ${apiState.unexpectedApis.join(', ')}`);
    assert(browserErrors.length === 0, `Browser exceptions: ${browserErrors.join('\n')}`);

    console.log(JSON.stringify({
      ok: true,
      scope: 'media-library-settings-browser-e2e',
      flow: ['login', 'page-select', 'settings', 'media-library', 'error-retry', 'honest-counts', 'search', 'filter', 'pagination-dedupe', 'active-use-delete-block', 'revision-double-confirm', 'narrow-desktop'],
      mediaListCount: apiState.mediaListCount,
      mediaListRequests: apiState.mediaListRequests,
      deleteRequests: apiState.deleteRequests.length,
      confirmMessages,
      narrowDesktop: narrow,
      screenshots: 1,
    }, null, 2));
  } finally {
    await client?.close().catch(() => {});
    if (child && !child.killed) child.kill('SIGTERM');
    await rm(profileDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
}

await run();
