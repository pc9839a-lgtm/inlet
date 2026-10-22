import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const origin = String(process.env.INLET_EDITOR_BROWSER_QA_ORIGIN || 'http://127.0.0.1:4174').replace(/\/$/, '');
const screenshotDir = process.env.INLET_EDITOR_BROWSER_QA_SCREENSHOT_DIR || '.tmp-editor-browser-regression';
const debugPort = Number(process.env.INLET_EDITOR_BROWSER_QA_CHROME_PORT || 9341);
const chromeInput = String(process.env.INLET_EDITOR_BROWSER_QA_CHROME_PATH || '').trim();
const updatedHeroTitle = '브라우저 저장 검증 완료';
const continuedHeroTitle = '발행 중 추가 편집 보존';
const revisionHeroTitle = '저장 버전 복원 검증';
const finalHeroTitle = '버전 복원 후 추가 편집';
const persistedCodeLabel = '신청 폼 코드';
const updatedAccent = '#7c3aed';
const desktopMatrix = [
  { name: 'pc-900', width: 900, height: 900, narrow: true },
  { name: 'pc-1024', width: 1024, height: 900, narrow: true },
  { name: 'pc-1180', width: 1180, height: 900, narrow: true },
  { name: 'pc-1440', width: 1440, height: 960, narrow: false },
];

const zoom200Matrix = [
  { name: 'zoom-200-from-1440', width: 720, height: 450 },
  { name: 'zoom-200-from-1280', width: 640, height: 400 },
];

const mobileViewports = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
];

const mobileKeyboardViewports = mobileViewports.map((viewport) => ({
  name: `${viewport.name}-keyboard`,
  width: viewport.width,
  height: 360,
}));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CDP_COMMAND_TIMEOUT_MS = 25000;
let activeQaStep = 'initialization';
function qaStep(label) {
  activeQaStep = String(label);
  console.log('[editor-qa]', activeQaStep);
}

function resolveChrome() {
  return [
    chromeInput,
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env.LocalAppData && path.join(process.env.LocalAppData, 'Google/Chrome/Application/chrome.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(Boolean).find((candidate) => existsSync(candidate)) || '';
}

async function fetchJson(url, init = {}) {
  // Chrome's debugging HTTP endpoint can also stall without returning an error.
  // Bound every poll so waitForChrome's outer deadline remains meaningful.
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), ...init });
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
    const deadline = setTimeout(() => reject(new Error('CDP WebSocket open timed out')), CDP_COMMAND_TIMEOUT_MS);
    const openedOk = () => { clearTimeout(deadline); resolve(); };
    const openedFailed = () => { clearTimeout(deadline); reject(new Error('CDP WebSocket open failed')); };
    socket.addEventListener('open', openedOk, { once: true });
    socket.addEventListener('error', openedFailed, { once: true });
    socket.addEventListener('close', () => {
      clearTimeout(deadline);
      reject(new Error('CDP WebSocket closed before opening'));
    }, { once: true });
  });

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(String(event.data));
    if (payload.id && pending.has(payload.id)) {
      const request = pending.get(payload.id);
      pending.delete(payload.id);
      clearTimeout(request.timer);
      if (payload.error) request.reject(new Error(payload.error.message || 'CDP error'));
      else request.resolve(payload.result || {});
      return;
    }
    if (payload.method) {
      for (const listener of listeners.get(payload.method) || []) listener(payload.params || {});
    }
  });

  socket.addEventListener('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('CDP socket closed during ' + request.method + ' at ' + activeQaStep));
    }
    pending.clear();
  });

  return {
    async send(method, params = {}, sessionId) {
      await opened;
      const id = nextId++;
      const response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('CDP command timed out: ' + method + ' (' + CDP_COMMAND_TIMEOUT_MS + 'ms) at ' + activeQaStep));
        }, CDP_COMMAND_TIMEOUT_MS);
        pending.set(id, { resolve, reject, timer, method });
      });
      try {
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      } catch (error) {
        const request = pending.get(id);
        if (request) {
          clearTimeout(request.timer);
          pending.delete(id);
          request.reject(error);
        }
      }
      return response;
    },
    on(method, listener) {
      listeners.set(method, [...(listeners.get(method) || []), listener]);
    },
    async close() {
      await opened.catch(() => {});
      socket.close();
    },
  };
}

function createQaUser() {
  return {
    id: 'editor-e2e-user',
    accountId: 'editor-owner',
    ownerId: 'editor-owner',
    workspaceId: 'editor-project',
    projectId: 'editor-project',
    name: '편집 QA',
    email: 'editor.qa@example.com',
    phone: '01012345678',
    role: 'master',
    accessMode: 'master',
    plan: 'QA',
    status: 'active',
  };
}

function createQaPage() {
  return {
    id: 'editor-e2e-page',
    projectId: 'editor-project',
    ownerId: 'editor-owner',
    ownerEmail: 'editor.qa@example.com',
    title: '편집 E2E 페이지',
    slug: 'editor-e2e',
    status: 'published',
    revision: 3,
    updatedAt: '2026-07-31T00:00:00.000Z',
    share: { enabled: true, position: 'top-right', display: 'icon' },
    theme: {
      accent: '#2563eb',
      bgMode: 'solid',
      bg: '#eef2f7',
      bgSolid: '#eef2f7',
      card: '#ffffff',
      text: '#111827',
      radius: 22,
      font: 'modern',
      fontFamily: 'pretendard',
      globalAlign: 'left',
      animOn: false,
      animType: 'fade',
      buttonEffect: 'fill',
    },
    meta: { title: '', desc: '', favicon: '', og: '' },
    integrations: {
      internal: { enabled: true },
      email: { enabled: false, to: '' },
      sheets: { enabled: false, provider: 'google_sheets', mode: 'webhook', status: 'disconnected', webhookUrl: '', url: '' },
    },
    blocks: [
      {
        id: 'editor-topnav',
        type: 'topnav',
        visible: true,
        s: {
          logoType: 'text',
          logoText: 'QA',
          logoStyle: 'badge',
          logoSize: 'small',
          menuStyle: 'pill',
          menuSize: 'small',
          bg: 'white',
          align: 'left',
          sticky: true,
          menus: [
            { id: 'editor-menu-1', label: '소개', target: 'editor-hero', url: '' },
            { id: 'editor-menu-2', label: '상담', target: 'editor-form', url: '' },
          ],
        },
      },
      {
        id: 'editor-hero',
        type: 'hero',
        visible: true,
        s: {
          anchorId: 'editor-hero',
          title: '저장 전 히어로 제목',
          body: '로그인부터 저장 후 재접속까지 실제 브라우저에서 검사합니다.',
          image: '',
          imageMode: 'top',
          imageFit: 'contain',
          imageHeightPx: 260,
          align: 'left',
          titleSize: 'large',
          bodySize: 'medium',
          height: 'medium',
        },
      },
      {
        id: 'editor-text',
        type: 'text',
        visible: true,
        s: {
          anchorId: 'editor-text',
          title: '편집기 회귀 방지',
          body: '페이지 선택, 블록 편집, 서버 저장, 재접속을 자동 확인합니다.',
          layout: 'card',
          align: 'left',
          size: 'medium',
        },
      },
      {
        id: 'editor-form',
        type: 'form',
        visible: true,
        s: {
          anchorId: 'editor-form',
          title: '상담 신청',
          desc: '테스트 폼',
          style: 'card',
          submit: '신청하기',
          privacy: '개인정보 수집 및 이용에 동의합니다.',
          privacyRequired: true,
          inputStyle: 'round',
          buttonStyle: 'solid',
          questions: [
            { id: 'editor-name', label: '이름', type: 'name', required: true, options: [] },
            { id: 'editor-phone', label: '연락처', type: 'phone', required: true, options: [] },
          ],
        },
      },
      {
        id: 'editor-code',
        type: 'code',
        visible: true,
        s: {
          anchorId: 'editor-code',
          editorLabel: '',
          widgetMode: 'custom',
          html: '<div id="code-preview-qa">QA code block<button id="code-toggle">더보기</button><div id="code-details" hidden>추가 내용</div></div>',
          css: '#code-preview-qa{background:rgb(219,234,254);padding:16px}#code-details{height:240px}',
          js: "document.getElementById('code-toggle').onclick = () => { const details = document.getElementById('code-details'); details.hidden = !details.hidden; };",
          runJs: true,
        },
      },
      {
        id: 'editor-bottom',
        type: 'bottombar',
        visible: true,
        s: {
          count: 2,
          style: 'pill',
          color: 'dark',
          timerEnabled: false,
          mobileOnly: true,
          buttons: [
            { id: 'editor-bottom-1', enabled: true, icon: '💬', label: '상담', target: 'editor-form', url: '' },
            { id: 'editor-bottom-2', enabled: true, icon: '☎️', label: '전화', target: 'phone', url: 'tel:01000000000' },
          ],
        },
      },
      {
        id: 'editor-footer',
        type: 'footer',
        visible: true,
        s: { company: '페이지로 QA', owner: 'QA', phone: '010-0000-0000', email: '', address: '', biz: '', align: 'center', bg: 'soft' },
      },
    ],
  };
}

function jsonBody(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

function parsePostData(value = '') {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function createApiMock(client, sharedState = null) {
  const user = createQaUser();
  const state = sharedState || {
    currentPage: createQaPage(),
    loginCount: 0,
    sessionCount: 0,
    projectListCount: 0,
    pageLoadCount: 0,
    publicVerifyCount: 0,
    saveCount: 0,
    saveDelayMs: 0,
    strictRevisionCheck: false,
    revisionConflictCount: 0,
    saveSnapshots: [],
    revisionListCount: 0,
    leadLoadCount: 0,
    loginBody: null,
    unexpectedApis: [],
    externalRequests: [],
    interceptError: null,
  };

  const fulfill = (requestId, status, payload) => client.send('Fetch.fulfillRequest', {
    requestId,
    responseCode: status,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Cache-Control', value: 'no-cache, no-store' },
    ],
    body: jsonBody(payload),
  });

  const handler = async ({ requestId, request }) => {
    const url = new URL(request.url);
    // The F04 QA must not send *any* external requests. Inspect attempted
    // pixel/analytics requests without delivering real ad impressions.
    if (['http:', 'https:'].includes(url.protocol) && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      state.externalRequests.push(request.url);
      await client.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      await client.send('Fetch.continueRequest', { requestId });
      return;
    }

    const method = String(request.method || 'GET').toUpperCase();
    const pathname = url.pathname;
    const body = parsePostData(request.postData || '');

    if (pathname === '/api/auth/login' && method === 'POST') {
      state.loginCount += 1;
      state.loginBody = body;
      await fulfill(requestId, 200, { user, session: 'editor-e2e-session' });
      return;
    }

    if (pathname === '/api/auth/session' && method === 'POST') {
      state.sessionCount += 1;
      await fulfill(requestId, 200, { user, session: 'editor-e2e-session' });
      return;
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      await fulfill(requestId, 200, { ok: true });
      return;
    }

    if (pathname === '/api/projects' && method === 'GET') {
      state.projectListCount += 1;
      const page = state.currentPage;
      await fulfill(requestId, 200, {
        pages: [{
          id: page.id,
          projectId: page.projectId,
          ownerId: page.ownerId,
          title: page.title,
          slug: page.slug,
          status: page.status,
          revision: page.revision,
          updatedAt: page.updatedAt,
          leadCount: 0,
        }],
      });
      return;
    }

    if (pathname === '/api/account-page' && method === 'GET') {
      state.pageLoadCount += 1;
      await fulfill(requestId, 200, { page: state.currentPage });
      return;
    }

    if (pathname === '/api/leads' && method === 'GET') {
      state.leadLoadCount += 1;
      await fulfill(requestId, 200, { leads: [], total: 0, nextCursor: null, hasMore: false });
      return;
    }

    if (pathname === '/api/events' && method === 'GET') {
      await fulfill(requestId, 200, { events: [], total: 0, nextCursor: null, hasMore: false });
      return;
    }

    if (pathname === '/api/stats/summary' && method === 'GET') {
      await fulfill(requestId, 200, { summary: null, leads: [], events: [] });
      return;
    }

    const pageMatch = pathname.match(/^\/api\/pages\/([^/]+)$/);
    if (pageMatch) {
      const slug = decodeURIComponent(pageMatch[1]);
      if (method === 'GET') {
        if (slug !== state.currentPage.slug) {
          await fulfill(requestId, 404, { error: 'not found', code: 'PAGE_NOT_FOUND' });
          return;
        }
        if (url.searchParams.get('public') === '1') state.publicVerifyCount += 1;
        else state.pageLoadCount += 1;
        await fulfill(requestId, 200, { page: state.currentPage });
        return;
      }

      if (method === 'POST' && slug === state.currentPage.slug) {
        const incomingPage = body.page || {};
        if (state.strictRevisionCheck && body.expectedUpdatedAt !== state.currentPage.updatedAt) {
          state.revisionConflictCount += 1;
          await fulfill(requestId, 409, {
            ok: false,
            code: 'PAGE_REVISION_CONFLICT',
            error: 'Page revision conflict',
            latest: { updatedAt: state.currentPage.updatedAt, revision: state.currentPage.revision },
            page: state.currentPage,
          });
          return;
        }
        state.saveCount += 1;
        const saveNumber = state.saveCount;
        state.saveSnapshots.push(structuredClone(incomingPage));
        if (state.saveDelayMs > 0) await wait(state.saveDelayMs);
        state.currentPage = {
          ...incomingPage,
          id: state.currentPage.id,
          projectId: state.currentPage.projectId,
          ownerId: state.currentPage.ownerId,
          slug: state.currentPage.slug,
          status: 'published',
          revision: Number(state.currentPage.revision || 0) + 1,
          updatedAt: `2026-07-31T00:${String(saveNumber).padStart(2, '0')}:00.000Z`,
        };
        await fulfill(requestId, 200, {
          ok: true,
          page: state.currentPage,
          saveMode: body.saveMode || url.searchParams.get('saveMode') || '',
          saveRequestId: body.saveRequestId || '',
        });
        return;
      }
    }

    if (/^\/api\/pages\/[^/]+\/revisions/.test(pathname) && method === 'GET') {
      state.revisionListCount += 1;
      const revisionPage = createQaPage();
      revisionPage.revision = 2;
      revisionPage.updatedAt = '2026-07-30T00:00:00.000Z';
      revisionPage.blocks = revisionPage.blocks.map((block) => (
        block.id === 'editor-hero'
          ? { ...block, s: { ...block.s, title: revisionHeroTitle } }
          : block
      ));
      await fulfill(requestId, 200, {
        revisions: [{
          id: 'editor-revision-2',
          revision: 2,
          revisionAt: '2026-07-30T00:00:00.000Z',
          title: '이전 저장본',
          blocks: revisionPage.blocks.length,
          page: revisionPage,
        }],
      });
      return;
    }

    state.unexpectedApis.push(`${method} ${pathname}`);
    await fulfill(requestId, 404, { error: 'unexpected browser QA API request', method, pathname });
  };

  client.on('Fetch.requestPaused', (params) => {
    handler(params).catch((error) => {
      state.interceptError = error;
      client.send('Fetch.failRequest', { requestId: params.requestId, errorReason: 'Failed' }).catch(() => {});
    });
  });

  return state;
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'Browser evaluation failed');
  }
  return response.result?.value;
}

async function waitForBrowser(client, expression, label, timeoutMs = 18000) {
  qaStep(label);
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
  qaStep(label);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (check()) return;
    await wait(100);
  }
  throw new Error(`${label} did not complete`);
}

async function setViewport(client, width, height, mobile = false) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 1,
    mobile,
  });
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 0 });
  await wait(350);
}

async function setInputValue(client, selector, value) {
  const result = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter?.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return element.value === ${JSON.stringify(value)};
  })()`);
  assert(result, `Unable to set input value for ${selector}`);
}

async function clickSelector(client, selector) {
  const clicked = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.scrollIntoView({ block: 'center', inline: 'center' });
    element.click();
    return true;
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

const KEYBOARD_KEYS = {
  Tab: { key: 'Tab', code: 'Tab', virtualKeyCode: 9 },
  Enter: { key: 'Enter', code: 'Enter', virtualKeyCode: 13 },
  Space: { key: ' ', code: 'Space', virtualKeyCode: 32 },
  Escape: { key: 'Escape', code: 'Escape', virtualKeyCode: 27 },
};

async function pressKeyboardKey(client, keyName, { shift = false } = {}) {
  const config = KEYBOARD_KEYS[keyName];
  assert(config, `Unsupported browser QA key: ${keyName}`);
  const modifiers = shift ? 8 : 0;
  const base = {
    key: config.key,
    code: config.code,
    windowsVirtualKeyCode: config.virtualKeyCode,
    nativeVirtualKeyCode: config.virtualKeyCode,
    modifiers,
  };
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await wait(120);
}

async function focusSelector(client, selector) {
  const focused = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.scrollIntoView({ block: 'center', inline: 'center' });
    element.focus();
    return document.activeElement === element;
  })()`);
  assert(focused, `Unable to focus ${selector}`);
}

async function clickPointer(client, selector) {
  const point = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    element.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  assert(point, `Unable to resolve click geometry: ${selector}`);

  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
  await wait(150);
}

async function normalBlockOrder(client) {
  return evaluate(client, `[...document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item')].map((item) => item.id)`);
}

async function normalBlockCount(client) {
  return evaluate(client, `document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item').length`);
}

async function dragPointer(client, sourceSelector, targetSelector) {
  const sourcePoint = await evaluate(client, `(() => {
    const source = document.querySelector(${JSON.stringify(sourceSelector)});
    if (!source) return null;
    source.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = source.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  assert(sourcePoint, `Unable to resolve drag source geometry: ${sourceSelector}`);

  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sourcePoint.x, y: sourcePoint.y });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sourcePoint.x, y: sourcePoint.y, button: 'left', buttons: 1, clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: sourcePoint.x,
    y: sourcePoint.y - 10,
    button: 'left',
    buttons: 1,
  });
  await wait(80);

  const targetPoint = await evaluate(client, `(() => {
    const target = document.querySelector(${JSON.stringify(targetSelector)});
    if (!target) return null;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + Math.max(2, rect.height / 2) };
  })()`);
  assert(targetPoint, `Unable to resolve drag target geometry: ${targetSelector}`);
  await wait(100);

  for (let step = 1; step <= 10; step += 1) {
    const ratio = step / 10;
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: sourcePoint.x + (targetPoint.x - sourcePoint.x) * ratio,
      y: (sourcePoint.y - 10) + (targetPoint.y - (sourcePoint.y - 10)) * ratio,
      button: 'left',
      buttons: 1,
    });
    await wait(45);
  }
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: targetPoint.x, y: targetPoint.y, button: 'left', buttons: 0, clickCount: 1 });
  await wait(250);
}

async function capture(client, name) {
  qaStep('screenshot: ' + name);
  const image = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  const target = path.join(screenshotDir, `${name}.png`);
  await writeFile(target, Buffer.from(image.data, 'base64'));
  return target;
}

async function collectDesktopMetrics(client) {
  return evaluate(client, String.raw`(() => {
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const shell = document.querySelector('.builder-shell');
    const left = document.querySelector('.left-workspace');
    const preview = document.querySelector('.preview-workspace');
    const frame = document.querySelector('.phone-frame');
    const header = document.querySelector('.panel-header');
    const workPanel = document.querySelector('.work-panel');
    const topTabs = document.querySelector('.top-tabs');
    const editTabs = document.querySelector('.edit-section-tabs');
    const cockpit = document.querySelector('.conversion-cockpit');
    return {
      path: location.pathname,
      bodyScrollWidth: document.body?.scrollWidth || 0,
      documentScrollWidth: document.documentElement?.scrollWidth || 0,
      innerWidth,
      shell: rect(shell),
      left: rect(left),
      preview: rect(preview),
      frame: rect(frame),
      header: rect(header),
      workPanel: rect(workPanel),
      topTabs: rect(topTabs),
      editTabs: rect(editTabs),
      cockpit: rect(cockpit),
      shellGridColumns: shell ? getComputedStyle(shell).gridTemplateColumns : '',
      mobile: shell?.classList.contains('mobile-operations-shell') || false,
      heroTitleVisible: !!frame && (frame.innerText || '').includes(${JSON.stringify(finalHeroTitle)}),
      fallback: !!document.querySelector('.app-error-screen, .error-screen, .block-render-fallback'),
    };
  })()`);
}

async function collectNarrowDesktopMetrics(client) {
  return evaluate(client, String.raw`(() => {
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    return {
      path: location.pathname,
      innerWidth,
      bodyScrollWidth: document.body?.scrollWidth || 0,
      documentScrollWidth: document.documentElement?.scrollWidth || 0,
      shell: rect(document.querySelector('.builder-shell')),
      left: rect(document.querySelector('.left-workspace')),
      workPanel: rect(document.querySelector('.work-panel')),
      editLayout: rect(document.querySelector('.edit-layout')),
      preview: rect(document.querySelector('.preview-workspace')),
      topTabs: rect(document.querySelector('.top-tabs')),
      editTabs: rect(document.querySelector('.edit-section-tabs')),
      cockpit: rect(document.querySelector('.conversion-cockpit')),
      shellGridColumns: getComputedStyle(document.querySelector('.builder-shell')).gridTemplateColumns,
      mobile: document.querySelector('.builder-shell')?.classList.contains('mobile-operations-shell') || false,
      fallback: !!document.querySelector('.app-error-screen, .error-screen, .block-render-fallback'),
    };
  })()`);
}

async function collectMobileMetrics(client) {
  return evaluate(client, String.raw`(() => {
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const shell = document.querySelector('.builder-shell');
    const left = document.querySelector('.left-workspace');
    const header = document.querySelector('.mobile-operations-header');
    const workPanel = document.querySelector('.work-panel');
    const tabs = document.querySelector('.top-tabs');
    const tabButtons = [...document.querySelectorAll('.top-tabs > button')];
    const tabStyle = tabs ? getComputedStyle(tabs) : null;
    return {
      path: location.pathname,
      innerWidth,
      bodyScrollWidth: document.body?.scrollWidth || 0,
      documentScrollWidth: document.documentElement?.scrollWidth || 0,
      shell: rect(shell),
      left: rect(left),
      header: rect(header),
      workPanel: rect(workPanel),
      tabs: rect(tabs),
      tabButtonRects: tabButtons.map(rect),
      tabButtonCount: tabButtons.length,
      activeTabCount: tabButtons.filter((button) => button.classList.contains('active')).length,
      tabsGridColumns: tabStyle?.gridTemplateColumns || '',
      tabsPosition: tabStyle?.position || '',
      tabsTop: tabStyle?.top || '',
      mobile: shell?.classList.contains('mobile-operations-shell') || false,
      previewExists: !!document.querySelector('.preview-workspace, .phone-frame'),
      text: (document.body?.innerText || '').slice(0, 500),
      fallback: !!document.querySelector('.app-error-screen, .error-screen, .block-render-fallback'),
    };
  })()`);
}

function assertInsideViewport(rect, width, label, tolerance = 3) {
  assert(rect, `${label} bounds are missing`);
  assert(rect.left >= -tolerance, `${label} spills left: ${JSON.stringify(rect)}`);
  assert(rect.right <= width + tolerance, `${label} spills right: ${JSON.stringify({ rect, width })}`);
}

function assertDesktop(metrics) {
  assert(metrics.path === '/app', `desktop editor route changed: ${metrics.path}`);
  assert(!metrics.mobile, 'desktop editor unexpectedly entered mobile operations mode');
  assert(!metrics.fallback, 'desktop editor rendered an error fallback');
  assert(metrics.bodyScrollWidth <= metrics.innerWidth + 3, `desktop body overflow: ${metrics.bodyScrollWidth} > ${metrics.innerWidth}`);
  assert(metrics.documentScrollWidth <= metrics.innerWidth + 3, `desktop document overflow: ${metrics.documentScrollWidth} > ${metrics.innerWidth}`);
  assertInsideViewport(metrics.shell, metrics.innerWidth, 'desktop builder shell');
  assertInsideViewport(metrics.left, metrics.innerWidth, 'desktop left workspace');
  assertInsideViewport(metrics.preview, metrics.innerWidth, 'desktop preview workspace');
  assert(metrics.frame?.top <= (metrics.preview?.top || 0) + 94, 'desktop phone preview must follow its compact width selector');
  assertInsideViewport(metrics.workPanel, metrics.innerWidth, 'desktop work panel');
  assertInsideViewport(metrics.topTabs, metrics.innerWidth, 'desktop main tabs');
  assertInsideViewport(metrics.editTabs, metrics.innerWidth, 'desktop edit subsection tabs');
  assert(!metrics.cockpit, 'desktop preview must not expose the removed conversion cockpit');
  assert(metrics.left?.right <= metrics.preview?.left + 3, `desktop editor and preview overlap: ${JSON.stringify({ left: metrics.left, preview: metrics.preview })}`);
  assert(String(metrics.shellGridColumns || '').trim().split(/\s+/).length >= 2, `desktop shell must keep two grid columns: ${metrics.shellGridColumns}`);
  assert(metrics.left?.width >= 575, `desktop editor pane is too narrow: ${metrics.left?.width}px`);
  assert(metrics.preview?.width >= 500, `desktop preview pane became too narrow: ${metrics.preview?.width}px`);
  assert(metrics.frame?.width >= 400 && metrics.frame?.width <= 432, `desktop phone frame width is invalid: ${metrics.frame?.width}`);
  assert(metrics.heroTitleVisible, 'saved hero title is not visible in desktop preview');
}

function assertNarrowDesktop(metrics, width) {
  assert(metrics.path === '/app', `narrow desktop editor route changed: ${metrics.path}`);
  assert(!metrics.mobile, 'narrow desktop unexpectedly entered mobile operations mode');
  assert(!metrics.fallback, 'narrow desktop rendered an error fallback');
  assert(metrics.bodyScrollWidth <= width + 3, `narrow desktop body overflow: ${metrics.bodyScrollWidth} > ${width}`);
  assert(metrics.documentScrollWidth <= width + 3, `narrow desktop document overflow: ${metrics.documentScrollWidth} > ${width}`);
  assertInsideViewport(metrics.shell, width, 'narrow desktop builder shell');
  assertInsideViewport(metrics.left, width, 'narrow desktop left workspace');
  assertInsideViewport(metrics.workPanel, width, 'narrow desktop work panel');
  assertInsideViewport(metrics.editLayout, width, 'narrow desktop edit layout');
  assertInsideViewport(metrics.topTabs, width, 'narrow desktop main tabs');
  assertInsideViewport(metrics.editTabs, width, 'narrow desktop edit subsection tabs');
  assert(!metrics.cockpit, 'narrow desktop preview must not expose the removed conversion cockpit');
  assert(String(metrics.shellGridColumns || '').trim().split(/\s+/).length === 1, `narrow desktop shell must stack into one grid column: ${metrics.shellGridColumns}`);
  assert(metrics.workPanel?.width >= width - 4, `narrow desktop work panel did not expand: ${metrics.workPanel?.width}px of ${width}px`);
  assert(metrics.editLayout?.width >= width - 48, `narrow desktop edit layout is still artificially capped: ${metrics.editLayout?.width}px of ${width}px`);
  assertInsideViewport(metrics.preview, width, 'narrow desktop preview workspace');
}

function assertMobile(metrics, viewport) {
  assert(metrics.path === '/app', `${viewport.name} editor route changed: ${metrics.path}`);
  assert(metrics.mobile, `${viewport.name} did not enter mobile operations mode`);
  assert(!metrics.previewExists, `${viewport.name} must not render the desktop preview pane`);
  assert(!metrics.fallback, `${viewport.name} rendered an error fallback`);
  assert(metrics.bodyScrollWidth <= viewport.width + 3, `${viewport.name} body overflow: ${metrics.bodyScrollWidth} > ${viewport.width}`);
  assert(metrics.documentScrollWidth <= viewport.width + 3, `${viewport.name} document overflow: ${metrics.documentScrollWidth} > ${viewport.width}`);
  assertInsideViewport(metrics.shell, viewport.width, `${viewport.name} builder shell`);
  assertInsideViewport(metrics.left, viewport.width, `${viewport.name} left workspace`);
  assertInsideViewport(metrics.header, viewport.width, `${viewport.name} operations header`);
  assertInsideViewport(metrics.workPanel, viewport.width, `${viewport.name} work panel`);
  assertInsideViewport(metrics.tabs, viewport.width, `${viewport.name} tabs`);
  assert(metrics.tabButtonCount === 2, `${viewport.name} must expose exactly two operations tabs: ${metrics.tabButtonCount}`);
  assert(metrics.activeTabCount === 1, `${viewport.name} must keep exactly one active operations tab: ${metrics.activeTabCount}`);
  assert(String(metrics.tabsGridColumns || '').trim().split(/\s+/).length === 2, `${viewport.name} tabs must render as two grid columns: ${metrics.tabsGridColumns}`);
  assert(metrics.tabsPosition === 'sticky' && metrics.tabsTop === '0px', `${viewport.name} operations tabs must stay sticky at the top: ${JSON.stringify({ position: metrics.tabsPosition, top: metrics.tabsTop })}`);
  assert(metrics.tabButtonRects.every((button) => button && button.width > 0 && button.height >= 36), `${viewport.name} operations tab hit areas are invalid: ${JSON.stringify(metrics.tabButtonRects)}`);
  for (const [index, button] of metrics.tabButtonRects.entries()) assertInsideViewport(button, viewport.width, `${viewport.name} tab button ${index + 1}`);
  assert(metrics.header?.bottom <= metrics.tabs?.top + 4, `${viewport.name} operations header overlaps the tab bar: ${JSON.stringify({ header: metrics.header, tabs: metrics.tabs })}`);
  assert(metrics.text.includes('모바일 운영'), `${viewport.name} mobile operations heading is missing`);
  assert(metrics.text.includes('접수함') && metrics.text.includes('통계'), `${viewport.name} operations tabs are missing`);
}

async function run() {
  const chrome = resolveChrome();
  assert(chrome, 'Chrome or Chromium executable was not found');
  await mkdir(screenshotDir, { recursive: true });
  const profileDir = await mkdtemp(path.join(tmpdir(), 'inlet-editor-browser-'));
  const backupDownloadDir = path.join(profileDir, 'backup-e2e');
  const browserErrors = [];
  let child = null;
  let client = null;
  let secondClient = null;

  try {
    qaStep('starting Chrome');
    child = spawn(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--hide-scrollbars',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    const chromeStderr = [];
    child.stderr?.on('data', (chunk) => {
      chromeStderr.push(String(chunk));
      if (chromeStderr.length > 60) chromeStderr.shift();
    });
    child.on('error', (error) => {
      chromeStderr.push('Chrome spawn error: ' + error.message);
    });
    console.log('[editor-qa] chrome executable:', chrome, 'debug port:', debugPort, 'pid:', child.pid || 'unavailable');
    try {
      await waitForChrome(debugPort);
    } catch (error) {
      const reason = chromeStderr.join('').slice(-6000).trim();
      throw new Error(error.message
        + '; chrome exit=' + String(child.exitCode)
        + '; signal=' + String(child.signalCode)
        + (reason ? '; chrome stderr=' + reason : '; chrome produced no stderr'));
    }
    await mkdir(backupDownloadDir, { recursive: true });
    const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
    const target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
    assert(target, 'Chrome page target was not found');

    client = createCdp(target.webSocketDebuggerUrl);
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      browserErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || 'Browser exception');
    });

    await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: backupDownloadDir });
    await client.send('DOM.enable');
    await client.send('Page.enable');
    // A real unsaved-work warning must be acknowledged for an automated reload.
    // Without a CDP dialog handler, Page.reload can remain pending indefinitely.
    client.on('Page.javascriptDialogOpening', (dialog) => {
      if (dialog.type === 'beforeunload') {
        client.send('Page.handleJavaScriptDialog', { accept: true }).catch((error) => {
          browserErrors.push('beforeunload dialog handling: ' + error.message);
        });
      }
    });
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    await client.send('Fetch.enable', { patterns: [{ urlPattern: '*://*/*', requestStage: 'Request' }] });
    const apiState = createApiMock(client);
    // Valid conversion tags make accidentally installing tracking observable.
    apiState.currentPage.meta = {
      ...apiState.currentPage.meta,
      gtm: 'GTM-F04QA', ga4: 'G-F04QA123', googleAdsTag: 'AW-12345678',
      pixel: '123456789012345', naver: 's_f04qa', kakao: '1234567890',
    };
    apiState.currentPage.integrations.conversion = {
      enabled: true, dataLayer: true, metaPixel: true,
      googleAds: true, naver: true, kakao: true,
    };
    qaStep('launch authenticated editor');

    await setViewport(client, 1280, 900, false);
    await client.send('Page.navigate', { url: `${origin}/login` });
    await waitForBrowser(client, `!!document.querySelector('.auth-card')`, 'login screen');

    await setInputValue(client, 'input[placeholder="email@example.com"]', createQaUser().email);
    await setInputValue(client, 'input[type="password"]', 'Editor1234');
    await clickSelector(client, '.auth-form button[type="submit"]');

    await waitForBrowser(client, `!!document.querySelector('.service-dashboard') && (document.body?.innerText || '').includes('편집 E2E 페이지')`, 'dashboard page list');
    assert(apiState.loginCount === 1, `login API must run exactly once: ${apiState.loginCount}`);
    assert(apiState.loginBody?.email === createQaUser().email, `login email mismatch: ${JSON.stringify(apiState.loginBody)}`);
    assert(String(apiState.loginBody?.password || '').length >= 6, 'login password was not submitted');
    assert(apiState.projectListCount >= 1, 'dashboard project list API did not run');
    await capture(client, 'desktop-dashboard');

    const opened = await evaluate(client, `(() => {
      const card = [...document.querySelectorAll('.service-landing-card')].find((item) => (item.innerText || '').includes('편집 E2E 페이지'));
      const button = card && [...card.querySelectorAll('button')].find((item) => item.textContent.trim() === '편집');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert(opened, 'dashboard editor button was not found');

    await waitForBrowser(client, `!!document.querySelector('.builder-shell:not(.mobile-operations-shell)') && !!document.querySelector('#editor-block-editor-hero') && !!document.querySelector('.phone-frame')`, 'desktop editor');
    await waitForBrowser(client, `(document.querySelector('.phone-frame')?.innerText || '').includes('저장 전 히어로 제목')`, 'initial editor preview');
    assert(apiState.pageLoadCount >= 1, 'selected page was not loaded from the page API');
    // Custom HTML/CSS/JS must be visible and interactive in the actual editor,
    // while the iframe cannot inherit editor credentials or submit live leads.
    await waitForBrowser(client, `!!document.querySelector('.phone-frame #block-editor-code iframe.custom-code-frame')`, 'custom code iframe in editor preview');
    await evaluate(client, `document.querySelector('.phone-frame #block-editor-code').scrollIntoView({block:'center'})`);
    await waitForBrowser(client, `parseInt(document.querySelector('.phone-frame #block-editor-code iframe').style.height, 10) > 48`, 'custom code content loaded and measured');
    // Chrome may put the opaque-origin sandbox in a separate renderer process.
    const codeTargets = await client.send('Target.getTargets');
    const codeTarget = codeTargets.targetInfos.find((target) => target.type === 'iframe' && target.url === 'about:srcdoc');
    let codeSessionId, codeContextId;
    if (codeTarget) {
      ({ sessionId: codeSessionId } = await client.send('Target.attachToTarget', { targetId: codeTarget.targetId, flatten: true }));
    } else {
      const codeFrameTree = await client.send('Page.getFrameTree');
      const findCodeFrame = (tree) => tree.frame.url === 'about:srcdoc'
        ? tree.frame : (tree.childFrames || []).map(findCodeFrame).find(Boolean);
      const codeFrame = findCodeFrame(codeFrameTree.frameTree);
      assert(codeFrame, 'custom code must create a real srcdoc frame');
      ({ executionContextId: codeContextId } = await client.send('Page.createIsolatedWorld', { frameId: codeFrame.id, worldName: 'code-preview-qa' }));
    }
    const evaluateCode = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, ...(codeContextId ? { contextId: codeContextId } : {}), returnByValue: true, awaitPromise: true }, codeSessionId);
      assert(!result.exceptionDetails, 'custom code frame evaluation failed: ' + JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const codeContent = await evaluateCode(`(() => ({ text: document.body.innerText, color: getComputedStyle(document.querySelector('#code-preview-qa')).backgroundColor }))()`);
    assert(codeContent.text.includes('QA code block') && codeContent.color === 'rgb(219, 234, 254)', 'editor must render stored HTML and CSS: ' + JSON.stringify(codeContent));
    await evaluateCode(`document.querySelector('#code-toggle').click()`);
    assert(await evaluateCode(`!document.querySelector('#code-details').hidden`), 'stored widget JavaScript must respond to clicks');
    await waitForBrowser(client, `parseInt(document.querySelector('.phone-frame #block-editor-code iframe').style.height, 10) >= 280`, 'custom code iframe expands after interaction');
    await capture(client, 'desktop-code-preview');
    const codeApiBefore = apiState.unexpectedApis.length;
    const codeIsolation = await evaluateCode(`(async () => {
      let parentBlocked = false, storageBlocked = false, fetchBlocked = false;
      try { void parent.document.body; } catch { parentBlocked = true; }
      try { localStorage.setItem('code-preview-qa', 'unsafe'); } catch { storageBlocked = true; }
      try { await fetch(${JSON.stringify(origin + '/api/leads')}, { method: 'POST', body: '{}' }); } catch { fetchBlocked = true; }
      return { parentBlocked, storageBlocked, fetchBlocked };
    })()`);
    assert(codeIsolation.parentBlocked && codeIsolation.storageBlocked && codeIsolation.fetchBlocked, 'custom preview must isolate editor session and reject live API writes: ' + JSON.stringify(codeIsolation));
    assert(apiState.unexpectedApis.length === codeApiBefore, 'custom preview must block requests before they reach a live API');
    const codeSandbox = await evaluate(client, `document.querySelector('.phone-frame #block-editor-code iframe').getAttribute('sandbox')`);
    assert(codeSandbox === 'allow-scripts', 'custom preview must not permit forms, popups, downloads or top navigation');
    await evaluateCode(`document.querySelector('#code-toggle').click()`);
    // F04: execute a real editor form with valid tracking IDs in the page.
    // Only fake same-origin APIs are accessible; outbound origins are blocked.
    const f04Before = await evaluate(client, `(() => {
      window.__f04ConversionCount = 0;
      window.addEventListener('inlet:form_submit', () => { window.__f04ConversionCount += 1; });
      return {
        keys: Object.keys(localStorage).filter((key) => key === 'pagero_client_id' || key.startsWith('inlet-duplicate-')).sort(),
        clientCookie: document.cookie.includes('pagero_client_id='),
        dataLayerLength: window.dataLayer?.length || 0,
      };
    })()`);
    const f04ApiBefore = apiState.unexpectedApis.length;
    const f04ExternalBefore = apiState.externalRequests.length;
    await waitForBrowser(client,
      `!!document.querySelector('.phone-frame .editor-preview #block-editor-form form')`,
      'F04 consultation form mounted in editor preview');
    await setInputValue(client, '.phone-frame #block-editor-form input[type="text"]', '미리보기 QA');
    await setInputValue(client, '.phone-frame #block-editor-form input[type="tel"]', '01098765432');
    await clickSelector(client, '.phone-frame #block-editor-form input[type="checkbox"]');
    await clickSelector(client, '.phone-frame #block-editor-form button[type="submit"]');
    await waitForBrowser(client, `!!document.querySelector('.phone-frame #block-editor-form .success')`,
      'F04 simulated consultation succeeded without a stored lead');
    const f04After = await evaluate(client, `(() => ({
      keys: Object.keys(localStorage).filter((key) => key === 'pagero_client_id' || key.startsWith('inlet-duplicate-')).sort(),
      clientCookie: document.cookie.includes('pagero_client_id='),
      dataLayerLength: window.dataLayer?.length || 0,
      conversionCount: window.__f04ConversionCount,
      injectedPixelScripts: [...document.querySelectorAll('script[src]')].map((el) => el.src).filter(
        (url) => ['googletagmanager.com', 'facebook.net/en_US/fbevents', 'wcs.naver.net', 'kas/static/kp.js'].some((token) => url.includes(token))
      ),
    }))()`);
    assert(JSON.stringify(f04After.keys) === JSON.stringify(f04Before.keys)
      && f04After.clientCookie === f04Before.clientCookie,
      'F04 preview must not write visitor identity or duplicate leads: ' + JSON.stringify({ f04Before, f04After }));
    assert(f04After.conversionCount === 0
      && f04After.dataLayerLength === f04Before.dataLayerLength
      && f04After.injectedPixelScripts.length === 0,
      'F04 editor preview must not fire conversion or install advertising scripts: ' + JSON.stringify(f04After));
    assert(apiState.unexpectedApis.length === f04ApiBefore && apiState.saveCount === 0,
      'F04 preview must not call lead, event, analytics or save endpoints: '
        + JSON.stringify(apiState.unexpectedApis.slice(f04ApiBefore)));
    assert(apiState.externalRequests.length === f04ExternalBefore,
      'F04 preview attempted outbound third-party tracking: '
        + JSON.stringify(apiState.externalRequests.slice(f04ExternalBefore)));
    await clickSelector(client, '.phone-frame #block-editor-form .success button');
    await waitForBrowser(client, `!!document.querySelector('.phone-frame #block-editor-form form')`,
      'F04 consultation preview reset without persisting');


    // ED-R08 integrated Chrome QA: download an actual JSON backup, attempt a
    // wrong-page upload, then import the real downloaded file through Chrome's
    // file-input protocol. No publish is allowed until the user chooses it.
    await waitForBrowser(client, `!!document.querySelector('.panel-backup-action summary') && !!document.querySelector('.panel-backup-action ~ input[type="file"][accept*="json"]')`, 'backup and restore menu in authenticated editor');
    await clickSelector(client, '.panel-backup-action summary');
    await clickButtonByText(client, '.panel-backup-dropdown', '파일 저장');
    let downloadedBackupName = '';
    for (let attempt = 0; attempt < 75; attempt += 1) {
      downloadedBackupName = (await readdir(backupDownloadDir)).find((file) => /^pagero-editor-e2e-backup-[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$/.test(file)) || '';
      if (downloadedBackupName) break;
      await wait(100);
    }
    assert(downloadedBackupName, 'real Chrome backup file download did not complete');
    const backupFiles = await readdir(backupDownloadDir);
    const backupName = backupFiles.find((file) => /^pagero-editor-e2e-backup-[0-9]{4}-[0-9]{2}-[0-9]{2}\.json$/.test(file));
    assert(backupName, 'Chrome downloaded backup filename is missing');
    const backupPath = path.join(backupDownloadDir, backupName);
    const backupText = await readFile(backupPath, 'utf8');
    const portableBackup = JSON.parse(backupText);
    assert(portableBackup.kind === 'pagero-page-draft-backup' && portableBackup.version === 1, 'downloaded backup format must be portable JSON v1');
    assert(portableBackup.draft?.page?.id === 'editor-e2e-page', 'downloaded backup must match active page');
    assert(portableBackup.draft?.page?.blocks?.find((block) => block.id === 'editor-hero')?.s?.title === '저장 전 히어로 제목', 'download must include current unpublished editor content');
    assert(!backupText.includes('editor-e2e-session'), 'backup must never include login session material');

    const uploadFileToEditor = async (absolutePath) => {
      const documentNode = await client.send('DOM.getDocument');
      const inputNode = await client.send('DOM.querySelector', {
        nodeId: documentNode.root.nodeId,
        selector: '.panel-backup-action ~ input[type="file"][accept*="json"]',
      });
      assert(inputNode.nodeId > 0, 'backup file input must be in the authenticated header');
      await client.send('DOM.setFileInputFiles', { files: [absolutePath], nodeId: inputNode.nodeId });
    };

    const mismatchedBackup = { ...portableBackup, identity: 'wrong-account:other-page' };
    const invalidBackupPath = path.join(backupDownloadDir, 'wrong-page.json');
    await writeFile(invalidBackupPath, JSON.stringify(mismatchedBackup));
    await uploadFileToEditor(invalidBackupPath);
    await waitForBrowser(client, `(document.querySelector('.toast-notice')?.innerText || '').includes('다른 계정이나 페이지')`, 'cross-page backup import rejected');
    assert(!await evaluate(client, `!!document.querySelector('.confirm-modal[role="dialog"]')`), 'invalid backup must not open restore confirmation');
    assert(apiState.saveCount === 0, 'invalid backup must not publish');

    await clickSelector(client, '#editor-block-editor-hero .screen-order-v2-head');
    const backupHeroInput = '#editor-block-editor-hero + .screen-order-v2-inline-editor textarea[placeholder="핵심 제목을 입력하세요"]';
    await waitForBrowser(client, `!!document.querySelector(${JSON.stringify(backupHeroInput)})`, 'hero editor before backup restore');
    await setInputValue(client, backupHeroInput, 'ED-R08 복원 전 임시 수정');
    await waitForBrowser(client, `(document.querySelector('.phone-frame')?.innerText || '').includes('ED-R08 복원 전 임시 수정')`, 'live edit before backup restore');
    await uploadFileToEditor(backupPath);
    await waitForBrowser(client, `(document.querySelector('.confirm-modal[role="dialog"]')?.innerText || '').includes('편집본 파일 복원')`, 'backup restore confirmation');
    await clickSelector(client, '.confirm-modal .confirm-primary');
    await waitForBrowser(client, `(document.querySelector('.phone-frame')?.innerText || '').includes('저장 전 히어로 제목') && !(document.querySelector('.phone-frame')?.innerText || '').includes('ED-R08 복원 전 임시 수정')`, 'downloaded file restored original hero');
    assert(apiState.saveCount === 0, 'manual file restore must not auto-publish');
    const restoredUnsavedGuard = await evaluate(client, `(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    })()`);
    assert(restoredUnsavedGuard, 'manual backup restore must mark the page as unpublished');
    await capture(client, 'editor-backup-restore-success');


    // The editor preview should contain the phone itself, without the redundant
    // canvas URL header or the inquiry/publish control strip above it.
    const previewManagementUi = await evaluate(client, `(() => ({
      canvasHeading: !!document.querySelector('.preview-top'),
      conversionCockpit: !!document.querySelector('.conversion-cockpit'),
      publishChecklist: !!document.querySelector('.publish-checklist'),
      frame: !!document.querySelector('.phone-frame'),
    }))()`);
    assert(
      previewManagementUi.frame
        && !previewManagementUi.canvasHeading
        && !previewManagementUi.conversionCockpit
        && !previewManagementUi.publishChecklist,
      `editor preview must not render the removed management toolbar: ${JSON.stringify(previewManagementUi)}`,
    );

    // D04: changing the editor-only viewport must resize actual rendered
    // landing content (excluding the phone border), preserve the draft, and
    // never publish a page or change the public renderer.
    const d04WidthSamples = [];
    for (const width of [360, 390, 430]) {
      await clickSelector(client, `.preview-width-option[data-content-width="${width}"]`);
      await waitForBrowser(client, `document.querySelector('.preview-width-option[data-content-width="${width}"]')?.getAttribute('aria-pressed') === 'true'`, `D04 selected ${width}px`);
      await waitForBrowser(client, `(() => {
        const content = document.querySelector('.preview-workspace .phone-frame > .landing-page');
        const actual = Number(document.querySelector('.preview-width-measured')?.dataset.measuredWidth);
        return !!content && Math.abs(content.getBoundingClientRect().width - ${width}) <= 2
          && actual === ${width}
          && document.querySelectorAll('.preview-width-option[aria-pressed="true"]').length === 1
          && document.querySelector('.preview-width-option[data-content-width="${width}"]')?.getAttribute('aria-pressed') === 'true';
      })()`, `D04 actual content width ${width}px`);
      d04WidthSamples.push(await evaluate(client, `(() => ({
        selected: document.querySelector('.preview-width-option[aria-pressed="true"]')?.dataset.contentWidth,
        actual: Math.round(document.querySelector('.preview-workspace .landing-page')?.getBoundingClientRect().width || 0),
        frame: Math.round(document.querySelector('.preview-workspace .phone-frame')?.getBoundingClientRect().width || 0),
      }))()`));
    }
    await clickSelector(client, '.preview-width-option[data-content-width="390"]');
    assert(d04WidthSamples.every((item) => Number(item.selected) === item.actual && item.frame >= item.actual + 14),
      `D04 selected and measured content widths must agree without counting phone borders: ${JSON.stringify(d04WidthSamples)}`);
    assert(apiState.saveCount === 0, 'D04 width selection must not publish');

    const editSectionTabStyle = await evaluate(client, `(() => {
      const tabs = document.querySelector('.edit-section-tabs[data-pagero-ui="edit-section-tabs-v2"]');
      const active = tabs?.querySelector('.edit-section-tab[aria-pressed="true"]');
      const inactive = tabs?.querySelector('.edit-section-tab[aria-pressed="false"]');
      if (!tabs || !active || !inactive) return null;
      const tabsStyle = getComputedStyle(tabs);
      const activeStyle = getComputedStyle(active);
      const inactiveStyle = getComputedStyle(inactive);
      return {
        tabsBackground: tabsStyle.backgroundColor,
        tabsBorderTopWidth: tabsStyle.borderTopWidth,
        tabsHeight: Math.round(tabs.getBoundingClientRect().height),
        activeBackground: activeStyle.backgroundColor,
        activeColor: activeStyle.color,
        activeHeight: Math.round(active.getBoundingClientRect().height),
        activeClassName: active.className,
        activeDataSelected: active.getAttribute('data-selected'),
        inactiveBackground: inactiveStyle.backgroundColor,
        inactiveClassName: inactive.className,
      };
    })()`);
    assert(editSectionTabStyle, 'isolated edit section tab computed styles were not resolved');
    assert(editSectionTabStyle.activeClassName === 'edit-section-tab', `active edit section tab must not reuse the global active class: ${editSectionTabStyle.activeClassName}`);
    assert(editSectionTabStyle.inactiveClassName === 'edit-section-tab', `inactive edit section tab class drifted: ${editSectionTabStyle.inactiveClassName}`);
    assert(editSectionTabStyle.activeDataSelected === 'true', 'active edit section tab must expose data-selected=true');
    assert(editSectionTabStyle.tabsBackground === 'rgb(238, 241, 245)', `edit section tabs must use light gray segmented background, got ${editSectionTabStyle.tabsBackground}`);
    assert(editSectionTabStyle.tabsBorderTopWidth === '0px', `edit section tabs outer border must be removed, got ${editSectionTabStyle.tabsBorderTopWidth}`);
    assert(editSectionTabStyle.tabsHeight === 38, `edit section tabs container must be exactly 38px tall: ${editSectionTabStyle.tabsHeight}px`);
    assert(editSectionTabStyle.activeBackground === 'rgb(255, 255, 255)', `active edit section tab must be white, got ${editSectionTabStyle.activeBackground}`);
    assert(editSectionTabStyle.activeColor !== 'rgb(255, 255, 255)', 'active edit section tab text must not be white-on-dark');
    assert(editSectionTabStyle.activeHeight === 32, `active edit section tab must be 32px tall, got ${editSectionTabStyle.activeHeight}px`);
    assert(editSectionTabStyle.inactiveBackground === 'rgba(0, 0, 0, 0)', `inactive edit section tab must stay transparent, got ${editSectionTabStyle.inactiveBackground}`);

    // Inbox remains accessible through the persistent workspace tab,
    // and keyboard focus must recover after the workspace transition.
    const inboxTransitionFocused = await evaluate(client, `(() => {
      const button = document.querySelector('#workspace-tab-inbox');
      if (!button) return false;
      button.focus();
      return document.activeElement === button;
    })()`);
    assert(inboxTransitionFocused, 'inbox workspace tab was not focusable');
    await clickSelector(client, '#workspace-tab-inbox');
    await waitForBrowser(client, `document.querySelector('#workspace-tab-inbox')?.getAttribute('aria-selected') === 'true'`, 'inbox workspace transition');
    await waitForBrowser(client, `document.activeElement?.id === 'workspace-tab-inbox'`, 'focus recovery after inbox transition');

    await focusSelector(client, '#workspace-tab-edit');
    await clickSelector(client, '#workspace-tab-edit');
    await waitForBrowser(client, `document.querySelector('#workspace-tab-edit')?.getAttribute('aria-selected') === 'true'`, 'return to edit workspace');
    assert(await evaluate(client, `document.activeElement?.id === 'workspace-tab-edit'`), 'workspace tab focus should remain stable after returning to edit');

    await capture(client, 'desktop-editor-before');

    // P9-1: real keyboard-only operation for editor rows and overflow dropdown.
    const heroTitleSelector = '#editor-block-editor-hero .screen-order-v2-title-wrap';
    const heroVisibilitySelector = '#editor-block-editor-hero .screen-order-v2-visibility-button';
    const formActionSelector = '#editor-block-editor-form .screen-order-v2-action';

    const dragKeyboardState = await evaluate(client, `(() => {
      const drag = document.querySelector('#editor-block-editor-hero .screen-order-v2-drag');
      return drag ? { tabIndex: drag.tabIndex, role: drag.getAttribute('role'), ariaHidden: drag.getAttribute('aria-hidden') } : null;
    })()`);
    assert(dragKeyboardState, 'hero drag handle was not found for keyboard audit');
    assert(dragKeyboardState.tabIndex < 0, `pointer-only drag handle must not create a dead Tab stop: ${JSON.stringify(dragKeyboardState)}`);
    assert(!dragKeyboardState.role, `pointer-only drag handle must not expose a non-operable button role: ${JSON.stringify(dragKeyboardState)}`);

    await focusSelector(client, heroTitleSelector);
    await pressKeyboardKey(client, 'Enter');
    await waitForBrowser(client, `document.querySelector(${JSON.stringify(heroTitleSelector)})?.getAttribute('aria-pressed') === 'true'`, 'hero row Enter activation');
    await waitForBrowser(client, `!!document.querySelector('#editor-block-editor-hero + .screen-order-v2-inline-editor[data-inline-block-editor="true"]')`, 'hero inline editor from Enter');

    await focusSelector(client, heroVisibilitySelector);
    await pressKeyboardKey(client, 'Space');
    await waitForBrowser(client, `document.querySelector(${JSON.stringify(heroVisibilitySelector)})?.getAttribute('aria-checked') === 'false'`, 'hero visibility Space activation off');
    await pressKeyboardKey(client, 'Space');
    await waitForBrowser(client, `document.querySelector(${JSON.stringify(heroVisibilitySelector)})?.getAttribute('aria-checked') === 'true'`, 'hero visibility Space activation on');

    await focusSelector(client, formActionSelector);
    await pressKeyboardKey(client, 'Enter');
    await waitForBrowser(client, `!!document.querySelector('.screen-order-v2-menu')`, 'form action dropdown from Enter');
    await waitForBrowser(client, `document.activeElement?.matches?.('.screen-order-v2-menu button:not(:disabled)')`, 'dropdown first keyboard action focus');
    const firstMenuActionText = await evaluate(client, 'document.activeElement?.textContent?.trim() || ""');
    await pressKeyboardKey(client, 'Tab');
    assert(await evaluate(client, `document.activeElement?.closest?.('.screen-order-v2-menu') !== null`), 'Tab must move within the open block action dropdown');
    assert((await evaluate(client, 'document.activeElement?.textContent?.trim() || ""')) !== firstMenuActionText, 'Tab must advance to the next dropdown action');
    await pressKeyboardKey(client, 'Tab', { shift: true });
    assert((await evaluate(client, 'document.activeElement?.textContent?.trim() || ""')) === firstMenuActionText, 'Shift+Tab must return to the previous dropdown action');
    await pressKeyboardKey(client, 'Escape');
    await waitForBrowser(client, `!document.querySelector('.screen-order-v2-menu')`, 'dropdown Escape close');
    assert(await evaluate(client, `document.activeElement === document.querySelector(${JSON.stringify(formActionSelector)})`), 'Escape must return dropdown focus to its trigger');

    await pressKeyboardKey(client, 'Space');
    await waitForBrowser(client, `!!document.querySelector('.screen-order-v2-menu')`, 'form action dropdown from Space');
    await waitForBrowser(client, `document.activeElement?.matches?.('.screen-order-v2-menu button:not(:disabled)')`, 'Space-opened dropdown action focus');
    await pressKeyboardKey(client, 'Escape');
    await waitForBrowser(client, `!document.querySelector('.screen-order-v2-menu')`, 'Space-opened dropdown Escape close');

    const heroEditorSelector = '.screen-order-v2-inline-editor textarea[placeholder="핵심 제목을 입력하세요"]';
    if (!(await evaluate(client, `document.querySelector(${JSON.stringify(heroTitleSelector)})?.getAttribute('aria-pressed') === 'true'`))) {
      await clickSelector(client, '#editor-block-editor-hero .screen-order-v2-head');
    }
    await waitForBrowser(client, `!!document.querySelector(${JSON.stringify(heroEditorSelector)})`, 'selected hero inline editor textarea');
    await waitForBrowser(client, `!!document.querySelector('#editor-block-editor-hero + .screen-order-v2-inline-editor[data-inline-block-editor="true"]')`, 'inline block editor directly below hero row');
    // D01: exercise the actual selected inspector DOM and CSS scroll contract.
    // A taller editor must scroll internally, without changing block order.
    const inspectorScroll = await evaluate(client, `(() => {
      const panel = document.querySelector('#editor-block-editor-hero + .screen-order-v2-inline-editor[data-scroll-region="block-settings"]');
      const content = panel?.querySelector('.block-editor-v2');
      if (!panel || !content) return null;
      const original = content.style.minHeight;
      let result;
      try {
        content.style.minHeight = '1600px';
        panel.scrollTop = 320;
        const style = getComputedStyle(panel);
        result = {
          role: panel.getAttribute('role'),
          label: panel.getAttribute('aria-label'),
          tabIndex: panel.tabIndex,
          overflowY: style.overflowY,
          maxHeight: parseFloat(style.maxHeight),
          height: panel.clientHeight,
          contentHeight: panel.scrollHeight,
          scrollTop: panel.scrollTop,
        };
      } finally {
        content.style.minHeight = original;
        panel.scrollTop = 0;
      }
      return result;
    })()`);
    assert(inspectorScroll?.role === 'region' && inspectorScroll.tabIndex === 0
      && inspectorScroll.label?.includes('상세 설정'), `D01 keyboard-scroll region must be accessible: ${JSON.stringify(inspectorScroll)}`);
    assert(inspectorScroll.overflowY === 'auto' && inspectorScroll.maxHeight > 0
      && inspectorScroll.contentHeight > inspectorScroll.height && inspectorScroll.scrollTop > 0,
      `D01 long block inspector must scroll independently on desktop: ${JSON.stringify(inspectorScroll)}`);

    // D02: the anchor moves to a native, collapsed advanced disclosure; the
    // existing anchorId must remain editable and drive the live preview anchor.
    const heroAdvanced = '#editor-block-editor-hero + .screen-order-v2-inline-editor .block-editor-advanced-settings';
    const heroAnchorInput = `${heroAdvanced} .block-editor-anchor-value input`;
    const initialAdvancedState = await evaluate(client, `(() => {
      const details = document.querySelector(${JSON.stringify(heroAdvanced)});
      const editor = details?.closest('.block-editor-v2-content');
      const input = details?.querySelector('.block-editor-anchor-value input');
      return details && input ? {
        open: details.open,
        last: editor?.lastElementChild === details,
        visibleBeforeOpening: input.getClientRects().length > 0,
        original: input.value,
        summary: details.querySelector('summary')?.textContent.trim(),
      } : null;
    })()`);
    assert(initialAdvancedState?.open === false
      && initialAdvancedState.last && !initialAdvancedState.visibleBeforeOpening
      && initialAdvancedState.original === 'editor-hero'
      && initialAdvancedState.summary?.includes('고급 설정'),
      `D02 anchor should start hidden after primary editor fields: ${JSON.stringify(initialAdvancedState)}`);
    await clickSelector(client, `${heroAdvanced} > summary`);
    await waitForBrowser(client,
      `document.querySelector(${JSON.stringify(heroAdvanced)})?.open === true`,
      'D02 advanced anchor disclosure opens');
    assert(await evaluate(client,
      `document.querySelector(${JSON.stringify(heroAnchorInput)})?.getClientRects().length > 0`),
      'D02 expanded anchor input must be visible and reachable');
    await setInputValue(client, heroAnchorInput, 'editor-hero-d02');
    await waitForBrowser(client,
      `document.querySelector(${JSON.stringify(heroAnchorInput)})?.value === 'editor-hero-d02' && !!document.querySelector('.phone-frame #editor-hero-d02')`,
      'D02 anchor update reaches preview landing DOM');
    await setInputValue(client, heroAnchorInput, 'editor-hero');
    await waitForBrowser(client,
      `document.querySelector(${JSON.stringify(heroAnchorInput)})?.value === 'editor-hero' && !!document.querySelector('.phone-frame #editor-hero')`,
      'D02 original anchor restored without changing save behavior');
    await clickSelector(client, `${heroAdvanced} > summary`);
    assert(await evaluate(client,
      `document.querySelector(${JSON.stringify(heroAdvanced)})?.open === false`),
      'D02 advanced anchor must close without dropping its value');
    // Fixed top-navigation blocks use a separate renderer and must share
    // the same disclosure placement and genuinely collapsed anchor controls.
    await clickSelector(client, '.topnav-fixed-card .fixed-open-button');
    await waitForBrowser(client,
      `!!document.querySelector('.topnav-fixed-card .block-editor-advanced-settings')`,
      'D02 fixed top navigation advanced anchor settings');
    const fixedAdvancedState = await evaluate(client, `(() => {
      const details = document.querySelector('.topnav-fixed-card .block-editor-advanced-settings');
      const root = details?.closest('.block-editor-v2-content');
      const input = details?.querySelector('.block-editor-anchor-value input');
      return details && input ? {
        open: details.open,
        last: root?.lastElementChild === details,
        hidden: input.getClientRects().length === 0,
      } : null;
    })()`);
    assert(fixedAdvancedState && !fixedAdvancedState.open
      && fixedAdvancedState.last && fixedAdvancedState.hidden,
      `D02 fixed editor anchor must be hidden after its content: ${JSON.stringify(fixedAdvancedState)}`);
    await clickSelector(client, '.topnav-fixed-card .fixed-open-button');
    await waitForBrowser(client, `!document.querySelector('.topnav-fixed-card .block-editor-advanced-settings')`,
      'D02 fixed navigation settings closed after inspection');
    if (!(await evaluate(client, `!!document.querySelector(${JSON.stringify(heroEditorSelector)})`))) {
      await clickSelector(client, '#editor-block-editor-hero .screen-order-v2-head');
    }
    await waitForBrowser(client, `!!document.querySelector(${JSON.stringify(heroEditorSelector)})`,
      'hero settings available after fixed anchor check');


    assert(!(await evaluate(client, `document.body.innerText.includes('선택한 블록 설정')`)), 'redundant selected block settings heading must stay removed');
    await capture(client, 'desktop-editor-inline-editor');
    await setInputValue(client, heroEditorSelector, updatedHeroTitle);
    await waitForBrowser(client, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(updatedHeroTitle)})`, 'live hero preview');
    await wait(250);
    assert(apiState.saveCount === 0, 'editing must not submit a server save before the save button is pressed');

    // D03: live title edits update row context without saving or changing ids.
    const heroRowIdentity = await evaluate(client, `(() => {
      const row = document.querySelector('#editor-block-editor-hero .screen-order-v2-title-wrap');
      return row ? {
        name: row.querySelector('.screen-order-v2-identity-copy strong')?.textContent,
        detail: row.querySelector('.screen-order-v2-identity-detail')?.textContent,
        accessibleName: row.getAttribute('aria-label'),
      } : null;
    })()`);
    assert(heroRowIdentity?.name === updatedHeroTitle
      && heroRowIdentity.detail === '히어로'
      && heroRowIdentity.accessibleName.includes(updatedHeroTitle),
      `D03 hero row should identify its live title: ${JSON.stringify(heroRowIdentity)}`);

    const stageOneList = await evaluate(client, `(() => {
      const card = getComputedStyle(document.querySelector('.screen-order-v2-card'));
      const list = getComputedStyle(document.querySelector('.screen-order-v2-list'));
      const selected = document.querySelector('#editor-block-editor-hero');
      const row = getComputedStyle(selected);
      const head = selected.querySelector('.screen-order-v2-head').getBoundingClientRect();
      const marker = getComputedStyle(selected, '::before');
      const other = document.querySelector('.screen-order-v2-item[data-selected="false"]');
      return {
        outerBorder: card.borderTopWidth, outerPadding: card.paddingTop,
        gap: list.rowGap, rowBorder: row.borderTopWidth, rowRadius: row.borderRadius,
        height: head.height, selectedColor: row.backgroundColor,
        otherColor: getComputedStyle(other).backgroundColor,
        markerWidth: marker.width, markerDisplay: marker.display,
        chevrons: document.querySelectorAll('.screen-order-v2-chevron').length,
        visibility: !!selected.querySelector('.screen-order-v2-visibility-button'),
        actions: !!selected.querySelector('.screen-order-v2-action'),
        paneWidth: document.querySelector('.left-workspace').getBoundingClientRect().width,
        panelWidth: document.querySelector('.work-panel').getBoundingClientRect().width,
        layoutWidth: document.querySelector('.edit-layout').getBoundingClientRect().width,
        rowWidth: selected.getBoundingClientRect().width,
      };
    })()`);
    assert(stageOneList.outerBorder === '0px' && stageOneList.outerPadding === '0px'
      && stageOneList.gap === '0px' && stageOneList.rowBorder === '0px'
      && stageOneList.rowRadius === '0px' && stageOneList.height >= 44 && stageOneList.height <= 46,
      'stage 1 block list must render flat rows with readable click targets: ' + JSON.stringify(stageOneList));
    assert(stageOneList.selectedColor !== stageOneList.otherColor && stageOneList.markerWidth === '3px'
      && stageOneList.markerDisplay === 'block' && stageOneList.chevrons === 0
      && stageOneList.visibility && stageOneList.actions,
      'stage 1 must clearly identify selection and retain visibility/action controls: ' + JSON.stringify(stageOneList));
    assert(stageOneList.panelWidth <= stageOneList.paneWidth + 1
      && stageOneList.layoutWidth <= stageOneList.panelWidth + 1,
      'editor controls must fit inside the desktop sidebar rather than being clipped: ' + JSON.stringify(stageOneList));

    // Duplicate a real text block through the UI and verify the two rows get
    // different ordinal identities, then undo to avoid affecting later QA.
    await clickSelector(client, '#editor-block-editor-text .screen-order-v2-action');
    await waitForBrowser(client, `!!document.querySelector('.screen-order-v2-menu')`, 'D03 text duplicate menu');
    await clickButtonByText(client, '.screen-order-v2-menu', '복제');
    await waitForBrowser(client,
      `document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item[data-block-type="text"]').length === 2`,
      'D03 two identical text types after duplication');
    const repeatedText = await evaluate(client, `(() => [...document.querySelectorAll(
      '.screen-order-v2-list .screen-order-v2-item[data-block-type="text"]'
    )].map((row) => ({
      id: row.id,
      label: row.querySelector('.screen-order-v2-identity-copy strong')?.textContent,
      detail: row.querySelector('.screen-order-v2-identity-detail')?.textContent,
      accessibleName: row.querySelector('.screen-order-v2-title-wrap')?.getAttribute('aria-label'),
    })))()`);
    assert(repeatedText.length === 2 && repeatedText[0].id !== repeatedText[1].id
      && repeatedText[0].detail === '텍스트 1' && repeatedText[1].detail === '텍스트 2'
      && repeatedText.every((row) => row.label === '편집기 회귀 방지'
        && row.accessibleName?.includes(row.label) && row.accessibleName?.includes(row.detail)),
      `D03 repeated block identity must remain distinct and accessible: ${JSON.stringify(repeatedText)}`);
    await clickSelector(client, '.panel-history-btn[aria-label="실행 취소"]');
    await waitForBrowser(client, `(() => {
      const rows = document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item[data-block-type="text"]');
      return rows.length === 1 && rows[0].querySelector('.screen-order-v2-identity-copy strong')?.textContent === '편집기 회귀 방지'
        && rows[0].querySelector('.screen-order-v2-identity-detail')?.textContent === '텍스트';
    })()`, 'D03 undo duplicate restores singleton label');
    assert(apiState.saveCount === 0, 'D03 row identities must not trigger server saves');

    // E2E-02 / E2E-03: the block-add dock is intentionally simple: open it and add a block directly.
    const initialNormalBlockCount = await normalBlockCount(client);
    await clickSelector(client, '.add-toggle');
    await waitForBrowser(client, `!!document.querySelector('.add-panel .widget-group-grid')`, 'simple block add panel');
    assert(!(await evaluate(client, `!!document.querySelector('.section-add-modes')`)), 'block add panel must not expose recommendation/industry mode tabs');
    assert(!(await evaluate(client, `!!document.querySelector('#pagero-widget-search')`)), 'block add panel must not expose the removed search field');
    assert(!(await evaluate(client, `!!document.querySelector('.section-pattern-card')`)), 'block add panel must not expose recommended section cards');
    await clickButtonByText(client, '.add-panel', '구분선');
    await waitForBrowser(client, `document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item').length === ${initialNormalBlockCount + 1}`, 'added divider row');
    const addedDividerId = (await normalBlockOrder(client)).find((id) => !['editor-block-editor-hero', 'editor-block-editor-text', 'editor-block-editor-form'].includes(id));
    assert(addedDividerId, 'added divider block id was not resolved');
    assert(apiState.saveCount === 0, 'adding a block must remain local before publish');

    await clickSelector(client, '.panel-history-btn[aria-label="실행 취소"]');
    await waitForBrowser(client, `document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item').length === ${initialNormalBlockCount}`, 'undo block add');
    await clickSelector(client, '.panel-history-btn[aria-label="다시 실행"]');
    await waitForBrowser(client, `document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item').length === ${initialNormalBlockCount + 1}`, 'redo block add');

    // E2E-04: visibility toggle must update the preview without publishing.
    await clickSelector(client, '#editor-block-editor-text .screen-order-v2-visibility-button');
    await waitForBrowser(client, `document.querySelector('#editor-block-editor-text .screen-order-v2-visibility-button')?.getAttribute('aria-checked') === 'false'`, 'text visibility off');
    await waitForBrowser(client, `(document.querySelector('#editor-block-editor-text .screen-order-v2-identity-detail')?.textContent || '').includes('숨김')`, 'hidden row carries a readable state label');
    await waitForBrowser(client, `!(document.querySelector('.phone-frame')?.innerText || '').includes('편집기 회귀 방지')`, 'hidden text removed from preview');

    // E2E-03: move the form above the text row through the real overflow menu.
    const orderBeforeMove = await normalBlockOrder(client);
    await clickSelector(client, '#editor-block-editor-form .screen-order-v2-action');
    await waitForBrowser(client, `!!document.querySelector('.screen-order-v2-menu')`, 'form action menu');
    await clickButtonByText(client, '.screen-order-v2-menu', '위로 이동');
    await waitForBrowser(client, `(() => {
      const ids = [...document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item')].map((item) => item.id);
      return ids.indexOf('editor-block-editor-form') < ids.indexOf('editor-block-editor-text');
    })()`, 'form moved above text');
    const orderAfterMove = await normalBlockOrder(client);
    assert(JSON.stringify(orderAfterMove) !== JSON.stringify(orderBeforeMove), 'block order did not change');

    // E2E-06: use real Chrome mouse input to drag the newly added divider to the first drop-zone.
    const dragOrderBefore = await normalBlockOrder(client);
    await dragPointer(
      client,
      `#${addedDividerId} .screen-order-v2-drag`,
      '.screen-order-v2-list .screen-order-v2-slot:first-child .screen-order-v2-drop-zone',
    );
    await waitForBrowser(client, `(() => {
      const ids = [...document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item')].map((item) => item.id);
      return ids[0] === ${JSON.stringify(addedDividerId)};
    })()`, 'pointer drag moved divider to first position');
    const dragOrderAfter = await normalBlockOrder(client);
    assert(JSON.stringify(dragOrderAfter) !== JSON.stringify(dragOrderBefore), 'pointer drag did not change block order');

    // F05: move HERO below a visible form through the actual editor UI.
    // The previous renderer hoisted HERO regardless of the stored order.
    await clickSelector(client, '#editor-block-editor-hero .screen-order-v2-action');
    await waitForBrowser(client, `!!document.querySelector('.screen-order-v2-menu')`,
      'F05 hero action menu');
    await clickButtonByText(client, '.screen-order-v2-menu', '아래로 이동');
    await waitForBrowser(client, `(() => {
      const rows = [...document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item')].map((x) => x.id);
      return rows.indexOf('editor-block-editor-form') < rows.indexOf('editor-block-editor-hero');
    })()`, 'F05 hero moved below form in editor');
    const f05Order = await evaluate(client, `(() => {
      const visibleIds = [...document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item:not(.is-hidden)')]
        .map((row) => row.id.replace(/^editor-block-/, ''));
      const previewIds = [...document.querySelectorAll('.phone-frame .landing-content > [id^="block-"]')]
        .map((el) => el.id.replace(/^block-/, ''))
        .filter((id) => visibleIds.includes(id));
      return { visibleIds, previewIds };
    })()`);
    assert(f05Order.visibleIds.includes('editor-form')
      && f05Order.visibleIds.indexOf('editor-form') < f05Order.visibleIds.indexOf('editor-hero'),
      'F05 fixture must put HERO behind form, not merely verify the default order');
    assert(JSON.stringify(f05Order.previewIds) === JSON.stringify(f05Order.visibleIds),
      'F05 live preview order must match editor order including HERO: ' + JSON.stringify(f05Order));
    assert(apiState.saveCount === 0, 'F05 reordering must remain a local draft until explicit publish');


    // D06: the form uses the same visible "내용 / 스타일" vocabulary as
    // hero, text, link, and other block editors without changing tab IDs.
    if (!(await evaluate(client, `document.querySelector('#editor-block-editor-form')?.dataset.selected === 'true'`))) {
      await clickSelector(client, '#editor-block-editor-form .screen-order-v2-head');
    }
    await waitForBrowser(client, `(() => {
      const panel = document.querySelector('#editor-block-editor-form + .screen-order-v2-inline-editor');
      const labels = [...(panel?.querySelectorAll('.editor-tabs-v2-list button') || [])].map((tab) => tab.textContent.trim());
      return labels.includes('내용') && labels.includes('스타일') && !labels.includes('기본');
    })()`, 'D06 form tabs use content/style vocabulary');
    assert(apiState.saveCount === 0, 'D06 switching editor tabs must not auto-publish');

    // E2E-11 / E2E-12: page/theme inspector previews the style draft, then applies it into the page draft.
    await clickButtonByText(client, '.edit-section-tabs', '페이지 옵션');
    await waitForBrowser(client, `!!document.querySelector('.editor-page-options-stack .style-panel')`, 'page theme editor');
    assert(await evaluate(client, `(document.querySelector('.edit-workflow-hint')?.innerText || '').includes('발행')`),
      'D06 editor must explain that applying edits and publishing are different steps');
    assert(await evaluate(client, `(document.querySelector('.style-apply-bar span')?.innerText || '').includes('스타일 적용됨')`),
      'D06 initially applied style status must be explicit');
    await clickButtonByText(client, '.style-subnav', '색상');
    await waitForBrowser(client, `!!document.querySelector('.style-panel input[type="color"]')`, 'style accent input');
    await setInputValue(client, '.style-panel input[type="color"]', updatedAccent);
    await waitForBrowser(client, `!document.querySelector('.style-apply-btn')?.disabled`, 'style apply enabled');
    assert(await evaluate(client, `(document.querySelector('.style-apply-bar span')?.innerText || '').includes('스타일 미적용')`),
      'D06 pending style must say it is preview-only until applied');
    assert(apiState.saveCount === 0, 'style preview must not publish automatically');

    // F02: an unapplied style survives leaving the edit tab and remounting
    // StylePanel. The top-level publish action must offer confirmation even
    // while another allowed workspace tab (the inbox) is selected.
    await clickSelector(client, '#workspace-tab-inbox');
    await waitForBrowser(client,
      `document.querySelector('#workspace-tab-inbox')?.getAttribute('aria-selected') === 'true'`,
      'F02 inbox tab selected while unapplied style is staged');
    assert(!await evaluate(client, `!!document.querySelector('.confirm-modal')`),
      'F02 changing workspace tabs must not ask to discard a style draft');
    assert(apiState.saveCount === 0, 'F02 workspace tab switch must not publish');
    await clickSelector(client, '.panel-actions .primary-btn');
    await waitForBrowser(client,
      `document.querySelector('.confirm-modal #confirm-modal-title')?.textContent?.includes('미적용 변경을 발행할까요?')`,
      'F02 tab-independent confirmation for an unapplied style');
    assert(apiState.saveCount === 0, 'F02 confirmation must not publish without user approval');
    await clickSelector(client, '.confirm-modal .confirm-cancel');
    await waitForBrowser(client, `!document.querySelector('.confirm-modal')`,
      'F02 cancelled confirmation keeps draft unsaved');
    await clickSelector(client, '#workspace-tab-edit');
    await waitForBrowser(client,
      `document.querySelector('#workspace-tab-edit')?.getAttribute('aria-selected') === 'true'`,
      'F02 back to edit tab');
    await waitForBrowser(client,
      `document.querySelector('.edit-section-tabs .edit-section-tab:first-child')?.textContent?.includes('미적용')`,
      'F02 unapplied style badge survives workspace switch');
    if (!(await evaluate(client, `!!document.querySelector('.editor-page-options-stack .style-panel')`))) {
      await clickSelector(client, '.edit-section-tabs .edit-section-tab:first-child');
    }
    await waitForBrowser(client, `!!document.querySelector('.editor-page-options-stack .style-panel')`,
      'F02 style panel remounted after returning to edit');
    await clickButtonByText(client, '.style-subnav', '색상');
    await waitForBrowser(client,
      `document.querySelector('.style-panel input[type="color"]')?.value === ${JSON.stringify(updatedAccent)}`,
      'F02 staged accent survives workspace switch');
    assert(await evaluate(client, `document.querySelector('.style-apply-btn')?.disabled === false`),
      'F02 restored staged style must remain unapplied');
    assert(apiState.saveCount === 0, 'F02 cancelled publish and tab switches must make no server writes');
    await clickSelector(client, '.style-apply-btn');
    await waitForBrowser(client, `document.querySelector('.style-apply-btn')?.disabled === true`, 'style applied to page draft');
    assert(await evaluate(client, `(document.querySelector('.style-apply-bar span')?.innerText || '').includes('스타일 적용됨')`),
      'D06 style apply must clearly distinguish page draft from public publish');

    await clickButtonByText(client, '.edit-section-tabs', '화면 순서');
    await waitForBrowser(client, `!!document.querySelector('.screen-order-v2-list')`, 'screen order after style apply');

    // E2E-13: the header shows the latest draft without opening the live
    // published slug, and the editor remains editable after closing it.
    await evaluate(client, `window.__pageroQaPreviewCalls = []; window.open = (...args) => { window.__pageroQaPreviewCalls.push(args); return null; };`);
    await clickButtonByText(client, '.panel-actions', '미리보기');
    await waitForBrowser(client, `!!document.querySelector('.editor-draft-preview-dialog')`, 'unsaved draft preview dialog');
    const draftPreviewState = await evaluate(client, `(() => ({
      visible: !!document.querySelector('.editor-draft-preview-phone .landing-page'),
      publishedLink: document.querySelector('.editor-draft-preview-actions a')?.getAttribute('rel') || '',
      openedCount: window.__pageroQaPreviewCalls?.length || 0,
    }))()`);
    assert(draftPreviewState.visible && draftPreviewState.publishedLink.includes('noopener') && draftPreviewState.openedCount === 0, 'draft must be shown without opening the live URL');
    const f05HeaderPreviewOrder = await evaluate(client, `[...document.querySelectorAll(
      '.editor-draft-preview-phone .landing-content > [id^="block-"]'
    )].map((el) => el.id.replace(/^block-/, '')).filter((id) => ${JSON.stringify(f05Order.visibleIds)}.includes(id))`);
    assert(JSON.stringify(f05HeaderPreviewOrder) === JSON.stringify(f05Order.visibleIds),
      'F05 header draft renderer must retain HERO below form and match editor order: '
        + JSON.stringify(f05HeaderPreviewOrder));

    await clickButtonByText(client, '.editor-draft-preview-actions', '닫기');
    assert((await evaluate(client, 'location.pathname')) === '/app', 'preview action must keep the editor page active');
    await clickSelector(client, '#editor-block-editor-hero .screen-order-v2-head');
    await waitForBrowser(client, `!!document.querySelector(${JSON.stringify(heroEditorSelector)})`, 'hero editor after preview');
    await setInputValue(client, heroEditorSelector, updatedHeroTitle);

    // E2E-14: delay the first publish response, edit again while it is in-flight, and ensure late response does not erase the newer local draft.
    apiState.saveDelayMs = 900;
    await clickSelector(client, '.panel-actions .primary-btn');
    await waitForState(() => apiState.saveCount === 1, 'first publish request start');
    await setInputValue(client, heroEditorSelector, continuedHeroTitle);
    await waitForBrowser(client, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(continuedHeroTitle)})`, 'continued edit while publish pending');
    apiState.saveDelayMs = 0;
    await waitForState(() => apiState.publicVerifyCount >= 1, 'first publish public verification');
    await waitForBrowser(client, `document.querySelector(${JSON.stringify(heroEditorSelector)})?.value === ${JSON.stringify(continuedHeroTitle)}`, 'newer local draft after delayed publish response');
    assert(apiState.saveSnapshots[0]?.blocks?.find((block) => block.id === 'editor-hero')?.s?.title === updatedHeroTitle, 'first server snapshot should contain the pre-race title');
    const f05FirstPublishedOrder = (apiState.saveSnapshots[0]?.blocks || [])
      .filter((block) => !['topnav', 'bottombar', 'footer'].includes(block.type) && block.visible !== false)
      .map((block) => block.id);
    assert(JSON.stringify(f05FirstPublishedOrder) === JSON.stringify(f05Order.visibleIds),
      'F05 persisted block order must equal editor and preview order: '
        + JSON.stringify({ f05FirstPublishedOrder, f05Order }));

    assert(apiState.saveSnapshots[0]?.theme?.accent === updatedAccent, 'style change was not included in the first publish snapshot');

    await waitForState(() => apiState.saveCount >= 2, 'automatic trailing publish');
    assert(apiState.saveCount === 2, `pending edit should require exactly one automatic trailing save, got ${apiState.saveCount}`);
    assert(apiState.saveSnapshots[1]?.blocks?.find((block) => block.id === 'editor-hero')?.s?.title === continuedHeroTitle, 'automatic trailing save did not capture the latest hero title');
    const f05TrailingOrder = (apiState.saveSnapshots[1]?.blocks || [])
      .filter((block) => !['topnav', 'bottombar', 'footer'].includes(block.type) && block.visible !== false)
      .map((block) => block.id);
    assert(JSON.stringify(f05TrailingOrder) === JSON.stringify(f05Order.visibleIds),
      'F05 trailing publish must preserve HERO position despite async saves');

    await waitForState(() => apiState.publicVerifyCount >= 1, 'latest public verification after trailing save');
    await waitForBrowser(client, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(continuedHeroTitle)})`, 'latest saved editor preview');
    assert(apiState.currentPage.blocks.find((block) => block.id === 'editor-hero')?.s?.title === continuedHeroTitle, 'latest server page does not contain the continued hero title');
    assert(apiState.currentPage.theme?.accent === updatedAccent, 'latest server page does not contain the applied accent');
    assert(apiState.currentPage.blocks.find((block) => block.id === 'editor-text')?.visible === false, 'visibility change did not persist');

    await capture(client, 'desktop-editor-saved');

    // P4: restore a prior server revision into the editor draft, verify undo/redo,
    // edit again, publish, then verify the final server/public readback survives reload.
    await clickButtonByText(client, '.top-tabs', '설정');
    await waitForBrowser(client, `!!document.querySelector('.settings-v3-root')`, 'settings panel');
    await waitForBrowser(client, `[...document.querySelectorAll('.settings-v3-sidebar button')].some((button) => button.textContent.trim() === '버전 기록')`, 'advanced settings navigation');
    await clickButtonByText(client, '.settings-v3-sidebar', '버전 기록');
    await waitForBrowser(client, `!!document.querySelector('.page-revision-history-section') && (document.querySelector('.page-revision-history-section')?.innerText || '').includes('버전 2')`, 'revision history list');
    await waitForState(() => apiState.revisionListCount >= 1, 'revision list request');

    await evaluate(client, `window.confirm = () => true; true`);
    await clickPointer(client, '.page-revision-history-section .page-revision-history-row .ghost-btn');
    await waitForBrowser(client, `(document.querySelector('.page-revision-history-section')?.innerText || '').includes('버전 2 불러옴')`, 'revision restored notice');
    await waitForBrowser(client, `(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    })()`, 'revision restore unsaved navigation guard');
    assert(apiState.saveCount === 2, 'revision restore must stay local before explicit publish');

    await clickButtonByText(client, '.top-tabs', '편집');
    await waitForBrowser(client, `!!document.querySelector('.screen-order-v2-list')`, 'edit panel after revision restore');
    await clickSelector(client, '#editor-block-editor-hero .screen-order-v2-head');
    await waitForBrowser(client, `!!document.querySelector(${JSON.stringify(heroEditorSelector)})`, 'hero editor after revision restore');
    await waitForBrowser(client, `document.querySelector(${JSON.stringify(heroEditorSelector)})?.value === ${JSON.stringify(revisionHeroTitle)}`, 'restored revision hero title');

    await clickSelector(client, '.panel-history-btn[aria-label="실행 취소"]');
    await waitForBrowser(client, `document.querySelector(${JSON.stringify(heroEditorSelector)})?.value === ${JSON.stringify(continuedHeroTitle)}`, 'undo revision restore');
    await clickSelector(client, '.panel-history-btn[aria-label="다시 실행"]');
    await waitForBrowser(client, `document.querySelector(${JSON.stringify(heroEditorSelector)})?.value === ${JSON.stringify(revisionHeroTitle)}`, 'redo revision restore');

    await setInputValue(client, heroEditorSelector, finalHeroTitle);
    await waitForBrowser(client, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(finalHeroTitle)})`, 'post-restore edit preview');
    await clickSelector(client, '.panel-history-btn[aria-label="실행 취소"]');
    await waitForBrowser(client, `document.querySelector(${JSON.stringify(heroEditorSelector)})?.value === ${JSON.stringify(revisionHeroTitle)}`, 'undo post-restore edit');
    await clickSelector(client, '.panel-history-btn[aria-label="다시 실행"]');
    await waitForBrowser(client, `document.querySelector(${JSON.stringify(heroEditorSelector)})?.value === ${JSON.stringify(finalHeroTitle)}`, 'redo post-restore edit');

    // Code blocks must be distinguishable by a persisted editor-only custom label.
    await clickSelector(client, '#editor-block-editor-code .screen-order-v2-head');
    await waitForBrowser(client, `!!document.querySelector('#editor-block-editor-code + .screen-order-v2-inline-editor input[aria-label="구분 이름"]')`, 'code block custom label input');
    await setInputValue(client, '#editor-block-editor-code + .screen-order-v2-inline-editor input[aria-label="구분 이름"]', persistedCodeLabel);
    await waitForBrowser(client, `(document.querySelector('#editor-block-editor-code .screen-order-v2-title-wrap strong')?.textContent || '').includes(${JSON.stringify(persistedCodeLabel)})`, 'screen order custom code label');

    // D06: code has a separate apply phase. Editing alone never publishes,
    // while applying updates only the local page draft.
    const codeDraftSelector = '#editor-block-editor-code + .screen-order-v2-inline-editor .code-editor-box textarea';
    const codeOriginal = await evaluate(client, `document.querySelector(${JSON.stringify(codeDraftSelector)})?.value ?? ''`);
    await waitForBrowser(client, `!!document.querySelector('.code-editor-actions [data-code-draft-state="applied"]')`, 'D06 code initially applied');
    await setInputValue(client, codeDraftSelector, `${codeOriginal}\n<!-- D06 staged code regression -->`);
    await waitForBrowser(client, `!!document.querySelector('.code-editor-actions [data-code-draft-state="pending"]')`, 'D06 code draft pending before apply');
    assert(apiState.saveCount === 2, 'D06 pending code edits must not publish');
    await clickSelector(client, '.code-editor-actions button');
    await waitForBrowser(client, `!!document.querySelector('.code-editor-actions [data-code-draft-state="applied"]')`, 'D06 code applied to page draft');
    assert(apiState.saveCount === 2, 'D06 code apply must not publish');

    // P9-2: modal focus must stay contained and return to the opener on Escape.
    const codeModalTrigger = '#editor-block-editor-code + .screen-order-v2-inline-editor .code-editor-head button';
    await focusSelector(client, codeModalTrigger);
    await clickSelector(client, codeModalTrigger);
    await waitForBrowser(client, `!!document.querySelector('.code-editor-modal-card[role="dialog"]')`, 'code editor modal open');
    await waitForBrowser(client, `document.activeElement?.closest?.('.code-editor-modal-card') !== null`, 'code editor modal initial focus');

    // P9-6: emulate a keyboard-short visual viewport while an editor textarea is focused.
    await setViewport(client, 390, 360, false);
    await focusSelector(client, '.code-editor-modal-card textarea');
    const keyboardModal = await evaluate(client, `(() => {
      const rect = (element) => {
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height };
      };
      const card = document.querySelector('.code-editor-modal-card');
      const textarea = card?.querySelector('textarea');
      const action = card?.querySelector('.code-editor-modal-actions button');
      const root = getComputedStyle(document.documentElement);
      return {
        innerHeight,
        visualHeight: Math.round(window.visualViewport?.height || innerHeight),
        cssVisualHeight: parseFloat(root.getPropertyValue('--pagero-visual-viewport-height')) || 0,
        card: rect(card),
        textarea: rect(textarea),
        action: rect(action),
        activeInside: document.activeElement === textarea,
      };
    })()`);
    assert(keyboardModal.activeInside, 'keyboard-short code modal textarea must retain focus');
    assert(keyboardModal.card?.top >= -2 && keyboardModal.card?.bottom <= keyboardModal.innerHeight + 2, `keyboard-short code modal escaped visible viewport: ${JSON.stringify(keyboardModal)}`);
    assert(keyboardModal.action?.bottom <= keyboardModal.card?.bottom + 1, `keyboard-short code modal save action is clipped: ${JSON.stringify(keyboardModal)}`);
    assert(Math.abs(keyboardModal.cssVisualHeight - keyboardModal.visualHeight) <= 2, `visual viewport CSS contract did not update: ${JSON.stringify(keyboardModal)}`);
    await capture(client, 'mobile-keyboard-code-modal-390');
    await setViewport(client, 1440, 960, false);
    await waitForBrowser(client, `!!document.querySelector('.code-editor-modal-card[role="dialog"]')`, 'code editor modal after keyboard viewport restore');

    await focusSelector(client, '.panel-actions .primary-btn');
    await pressKeyboardKey(client, 'Tab');
    assert(await evaluate(client, `document.activeElement?.closest?.('.code-editor-modal-card') !== null`), 'forward Tab from outside must be recovered into the modal');

    await focusSelector(client, '.code-editor-modal-actions button');
    await pressKeyboardKey(client, 'Tab');
    assert(await evaluate(client, `document.activeElement === document.querySelector('.code-editor-modal-head button')`), 'Tab from the last modal control must wrap to the first');
    await pressKeyboardKey(client, 'Tab', { shift: true });
    assert(await evaluate(client, `document.activeElement === document.querySelector('.code-editor-modal-actions button')`), 'Shift+Tab from the first modal control must wrap to the last');

    await pressKeyboardKey(client, 'Escape');
    await waitForBrowser(client, `!document.querySelector('.code-editor-modal-card')`, 'code editor modal Escape close');
    await waitForBrowser(client, `document.activeElement === document.querySelector(${JSON.stringify(codeModalTrigger)})`, 'modal focus return to opener');

    await clickSelector(client, '.panel-actions .primary-btn');
    await waitForState(() => apiState.saveCount === 3, 'publish restored revision with additional edit');
    await waitForState(() => apiState.publicVerifyCount >= 2, 'public verification after revision publish');
    assert(apiState.saveSnapshots[2]?.blocks?.find((block) => block.id === 'editor-hero')?.s?.title === finalHeroTitle, 'revision publish snapshot did not include the final hero title');
    assert(apiState.currentPage.blocks.find((block) => block.id === 'editor-hero')?.s?.title === finalHeroTitle, 'server page did not keep the final post-restore edit');
    assert(apiState.saveSnapshots[2]?.blocks?.find((block) => block.id === 'editor-code')?.s?.editorLabel === persistedCodeLabel, 'final publish snapshot did not include the code block custom label');
    assert(apiState.currentPage.blocks.find((block) => block.id === 'editor-code')?.s?.editorLabel === persistedCodeLabel, 'server page did not keep the code block custom label');

    const pageLoadsBeforeReload = apiState.pageLoadCount;
    await client.send('Page.reload');
    await waitForBrowser(client, `!!document.querySelector('.builder-shell:not(.mobile-operations-shell)') && !!document.querySelector('.phone-frame')`, 'reloaded desktop editor');
    await waitForBrowser(client, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(finalHeroTitle)})`, 'saved page after reload');
    await waitForBrowser(client, `!!document.querySelector('.panel-actions .primary-btn:not(:disabled)')`, 'publish action after reload');
    await waitForState(() => apiState.pageLoadCount > pageLoadsBeforeReload, 'fresh account page read after reload');
    assert(apiState.saveCount === 3, `reload must not trigger another publish, got ${apiState.saveCount}`);
    const f05AfterReload = await evaluate(client, `(() => {
      const visibleIds = [...document.querySelectorAll('.screen-order-v2-list .screen-order-v2-item:not(.is-hidden)')]
        .map((row) => row.id.replace(/^editor-block-/, ''));
      const previewIds = [...document.querySelectorAll('.phone-frame .landing-content > [id^="block-"]')]
        .map((el) => el.id.replace(/^block-/, ''))
        .filter((id) => visibleIds.includes(id));
      return { visibleIds, previewIds };
    })()`);
    assert(JSON.stringify(f05AfterReload.visibleIds) === JSON.stringify(f05AfterReload.previewIds),
      'F05 renderer must match persisted order after reload: ' + JSON.stringify(f05AfterReload));
    const f05RevisionOrder = (apiState.currentPage.blocks || [])
      .filter((block) => !['topnav', 'bottombar', 'footer'].includes(block.type) && block.visible !== false)
      .map((block) => block.id);
    assert(JSON.stringify(f05AfterReload.visibleIds) === JSON.stringify(f05RevisionOrder),
      'F05 intentionally restored older revision must also render its own saved block order');

    const reloadGuardPrevented = await evaluate(client, `(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    })()`);
    assert(reloadGuardPrevented === false, 'clean saved page must not keep the unsaved navigation guard after reload');
    await clickSelector(client, '#editor-block-editor-code .screen-order-v2-head');
    await waitForBrowser(client, `document.querySelector('#editor-block-editor-code + .screen-order-v2-inline-editor input[aria-label="구분 이름"]')?.value === ${JSON.stringify(persistedCodeLabel)}`, 'persisted code block custom label after reload');
    await waitForBrowser(client, `(document.querySelector('#editor-block-editor-code .screen-order-v2-title-wrap strong')?.textContent || '').includes(${JSON.stringify(persistedCodeLabel)})`, 'persisted screen-order code label after reload');
    assert(apiState.sessionCount >= 1, 'saved login session was not refreshed after reload');
    const desktopMetrics = await collectDesktopMetrics(client);
    assertDesktop(desktopMetrics);
    await capture(client, 'desktop-editor-reloaded');

    for (const desktopViewport of desktopMatrix) {
      await setViewport(client, desktopViewport.width, desktopViewport.height, false);
      await waitForBrowser(client, `!!document.querySelector('.builder-shell:not(.mobile-operations-shell)') && !!document.querySelector('.preview-workspace')`, `${desktopViewport.name} editor`);

      await clickButtonByText(client, '.edit-section-tabs', '페이지 옵션');
    await waitForBrowser(client, `!!document.querySelector('.page-global-options-card')`, 'narrow desktop page options');
    const pageOptionsShellStyle = await evaluate(client, `(() => {
      const el = document.querySelector('.page-global-options-card');
      const style = getComputedStyle(el);
      return {
        padding: style.paddingTop,
        borderWidth: style.borderTopWidth,
        borderRadius: style.borderTopLeftRadius,
        background: style.backgroundColor,
      };
    })()`);
    assert(pageOptionsShellStyle?.padding === '14px', `page options shell padding drifted at desktop matrix width: ${JSON.stringify(pageOptionsShellStyle)}`);
    assert(pageOptionsShellStyle?.borderWidth === '1px', `page options shell border drifted at desktop matrix width: ${JSON.stringify(pageOptionsShellStyle)}`);
    assert(pageOptionsShellStyle?.borderRadius === '12px', `page options shell radius drifted at desktop matrix width: ${JSON.stringify(pageOptionsShellStyle)}`);
    await capture(client, 'desktop-narrow-1180-page-options');

    await clickButtonByText(client, '.edit-section-tabs', '화면 순서');
    await waitForBrowser(client, `!!document.querySelector('.screen-order-v2-card')`, 'narrow desktop screen order');
    const screenOrderShellStyle = await evaluate(client, `(() => {
      const shell = document.querySelector('.screen-order-v2-card');
      const row = document.querySelector('.screen-order-v2-item');
      const add = document.querySelector('.fixed-add-dock .add-toggle');
      const style = getComputedStyle(shell);
      const rowStyle = row ? getComputedStyle(row) : null;
      const addStyle = add ? getComputedStyle(add) : null;
      return {
        padding: style.paddingTop,
        borderWidth: style.borderTopWidth,
        borderRadius: style.borderTopLeftRadius,
        background: style.backgroundColor,
        rowRadius: rowStyle?.borderTopLeftRadius || '',
        rowBorder: rowStyle?.borderTopWidth || '',
        addBackground: addStyle?.backgroundColor || '',
      };
    })()`);
    assert(screenOrderShellStyle?.padding === '0px' && screenOrderShellStyle?.borderWidth === '0px'
      && screenOrderShellStyle?.borderRadius === '0px', `screen order must retain a flat shell at every desktop width: ${JSON.stringify(screenOrderShellStyle)}`);
    assert(screenOrderShellStyle?.background === 'rgba(0, 0, 0, 0)', `screen order shell must not introduce another filled card: ${JSON.stringify(screenOrderShellStyle)}`);
    assert(screenOrderShellStyle?.rowRadius === '0px' && screenOrderShellStyle?.rowBorder === '0px', `screen order rows must remain a simple list: ${JSON.stringify(screenOrderShellStyle)}`);
    assert(screenOrderShellStyle?.addBackground === 'rgb(17, 24, 39)', `block add trigger must keep the original dark style: ${JSON.stringify(screenOrderShellStyle)}`);

      if (desktopViewport.width === 1180) {
        await clickSelector(client, '#editor-block-editor-text .screen-order-v2-head');
        await waitForBrowser(client, `!!document.querySelector('#editor-block-editor-text + .screen-order-v2-inline-editor .editor-tabs-v2')`, 'narrow desktop inline text editor');
    const inlineDetailStyle = await evaluate(client, `(() => {
      const inline = document.querySelector('#editor-block-editor-text + .screen-order-v2-inline-editor');
      const anchor = inline?.querySelector('.block-editor-anchor-control');
      const label = inline?.querySelector('.editor-field-v2-label strong');
      const textarea = inline?.querySelector('.editor-field-v2 textarea');
      const tab = inline?.querySelector('.editor-tabs-v2-list > button');
      if (!inline || !anchor || !label || !textarea || !tab) return null;
      const inlineStyle = getComputedStyle(inline);
      const anchorStyle = getComputedStyle(anchor);
      const labelStyle = getComputedStyle(label);
      const textareaStyle = getComputedStyle(textarea);
      const tabStyle = getComputedStyle(tab);
      return {
        inlineMarginTop: inlineStyle.marginTop,
        anchorColumns: anchorStyle.gridTemplateColumns,
        labelFontSize: labelStyle.fontSize,
        textareaFontSize: textareaStyle.fontSize,
        textareaLineHeight: textareaStyle.lineHeight,
        tabHeight: Math.round(tab.getBoundingClientRect().height),
      };
    })()`);
    assert(inlineDetailStyle?.inlineMarginTop === '10px', `inline editor top spacing drifted: ${JSON.stringify(inlineDetailStyle)}`);
    assert(inlineDetailStyle?.labelFontSize === '13px', `inline editor labels must remain readable: ${JSON.stringify(inlineDetailStyle)}`);
    assert(inlineDetailStyle?.textareaFontSize === '14px', `inline editor text must remain readable: ${JSON.stringify(inlineDetailStyle)}`);
    assert(inlineDetailStyle?.tabHeight === 32, `inline editor tabs must keep 32px height: ${JSON.stringify(inlineDetailStyle)}`);
        await capture(client, 'desktop-narrow-1180-screen-order-detail');
      }

      if (desktopViewport.narrow) {
        // D05: a row the user is already viewing must not make the stacked
        // preview scroll the outer page to the preview area.
        const beforeD05 = await evaluate(client, `(() => {
          // The previous viewport may already have selected the form row:
          // select a different row so this actually exercises a transition.
          const form = document.querySelector('#editor-block-editor-form');
          const candidate = form?.dataset.selected === 'true'
            ? document.querySelector('#editor-block-editor-hero') : form;
          const row = candidate?.querySelector('.screen-order-v2-head');
          if (!row) return null;
          row.scrollIntoView({ behavior: 'instant', block: 'center' });
          const before = document.scrollingElement?.scrollTop ?? window.scrollY;
          row.click();
          return { before, viewport: innerWidth, itemId: candidate.id };
        })()`);
        assert(beforeD05 && beforeD05.viewport === desktopViewport.width, 'D05 stacked editor row click setup failed');
        await waitForBrowser(client,
          `document.getElementById(${JSON.stringify(beforeD05.itemId)})?.dataset.selected === 'true'`,
          `D05 narrow desktop row selection ${desktopViewport.width}px`);
        await wait(160);
        const afterD05 = await evaluate(client, 'document.scrollingElement?.scrollTop ?? window.scrollY');
        assert(Math.abs(afterD05 - beforeD05.before) <= 4,
          `D05 row selection changed outer scroll at ${desktopViewport.width}px: ${beforeD05.before} -> ${afterD05}`);
        const matrixMetrics = await collectNarrowDesktopMetrics(client);
        assertNarrowDesktop(matrixMetrics, desktopViewport.width);
      } else {
        const matrixMetrics = await collectDesktopMetrics(client);
        assertDesktop(matrixMetrics);
      }
      await capture(client, `desktop-matrix-${desktopViewport.width}`);
    }

    // P9-3: 200% desktop zoom is represented by the halved CSS viewport while
    // keeping a fine-pointer desktop input mode. Builder/settings must remain usable
    // instead of being replaced by the mobile operations-only surface.
    for (const zoomViewport of zoom200Matrix) {
      await setViewport(client, zoomViewport.width, zoomViewport.height, false);
      await waitForBrowser(client, `!!document.querySelector('.builder-shell.edit-mode-shell:not(.mobile-operations-shell)') && !!document.querySelector('.preview-workspace')`, `${zoomViewport.name} editor reflow`);

      const zoomMetrics = await collectNarrowDesktopMetrics(client);
      assertNarrowDesktop(zoomMetrics, zoomViewport.width);

      const zoomChrome = await evaluate(client, `(() => {
        const rect = (element) => {
          if (!element) return null;
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
        };
        const dock = document.querySelector('.fixed-add-dock');
        const add = document.querySelector('.fixed-add-dock .add-toggle');
        const header = document.querySelector('.panel-header');
        const actions = [...document.querySelectorAll('.panel-actions button')].map(rect);
        const dockStyle = dock ? getComputedStyle(dock) : null;
        return {
          dock: rect(dock),
          add: rect(add),
          header: rect(header),
          actions,
          dockPosition: dockStyle?.position || '',
          bodyOverflowX: getComputedStyle(document.body).overflowX,
          bodyOverflowY: getComputedStyle(document.body).overflowY,
        };
      })()`);

      assertInsideViewport(zoomChrome.dock, zoomViewport.width, `${zoomViewport.name} add dock`);
      assertInsideViewport(zoomChrome.add, zoomViewport.width, `${zoomViewport.name} add button`);
      assertInsideViewport(zoomChrome.header, zoomViewport.width, `${zoomViewport.name} panel header`);
      zoomChrome.actions.forEach((action, index) => assertInsideViewport(action, zoomViewport.width, `${zoomViewport.name} header action ${index + 1}`));
      assert(zoomChrome.dockPosition !== 'fixed', `${zoomViewport.name} add dock must not become a viewport-fixed overlap: ${zoomChrome.dockPosition}`);
      assert(['auto', 'hidden'].includes(zoomChrome.bodyOverflowX), `${zoomViewport.name} body horizontal overflow mode is unexpected: ${zoomChrome.bodyOverflowX}`);
      assert(['auto', 'visible'].includes(zoomChrome.bodyOverflowY), `${zoomViewport.name} body must stay vertically reachable: ${zoomChrome.bodyOverflowY}`);
      await capture(client, zoomViewport.name);
    }

    // Settings must also reflow at the 200% equivalent viewport without page-level
    // horizontal scrolling or a clipped active panel.
    await setViewport(client, 640, 400, false);
    await clickButtonByText(client, '.top-tabs', '설정');
    await waitForBrowser(client, `!!document.querySelector('.builder-shell.settings-workspace-shell:not(.mobile-operations-shell) .settings-v3-root')`, 'zoom-200 settings workspace');
    await clickButtonByText(client, '.settings-v3-sidebar', 'SEO 설정');
    await waitForBrowser(client, `(document.querySelector('#settings-active-title')?.textContent || '').includes('SEO')`, 'zoom-200 SEO settings section');

    const zoomSettings = await evaluate(client, `(() => {
      const rect = (element) => {
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
      };
      const sidebar = document.querySelector('.settings-v3-sidebar');
      const main = document.querySelector('.settings-v3-main');
      const panel = document.querySelector('#settings-active-panel');
      const content = document.querySelector('.settings-v3-content-wrap');
      return {
        innerWidth,
        bodyScrollWidth: document.body?.scrollWidth || 0,
        documentScrollWidth: document.documentElement?.scrollWidth || 0,
        sidebar: rect(sidebar),
        main: rect(main),
        panel: rect(panel),
        content: rect(content),
        sidebarOverflowX: sidebar ? getComputedStyle(sidebar).overflowX : '',
        rootColumns: getComputedStyle(document.querySelector('.settings-v3-root')).gridTemplateColumns,
      };
    })()`);
    assert(zoomSettings.bodyScrollWidth <= 643, `zoom-200 settings body overflow: ${zoomSettings.bodyScrollWidth}`);
    assert(zoomSettings.documentScrollWidth <= 643, `zoom-200 settings document overflow: ${zoomSettings.documentScrollWidth}`);
    assertInsideViewport(zoomSettings.sidebar, 640, 'zoom-200 settings sidebar');
    assertInsideViewport(zoomSettings.main, 640, 'zoom-200 settings main');
    assertInsideViewport(zoomSettings.panel, 640, 'zoom-200 settings active panel');
    assertInsideViewport(zoomSettings.content, 640, 'zoom-200 settings content');
    assert(String(zoomSettings.rootColumns || '').trim().split(/\s+/).length === 1, `zoom-200 settings must collapse to one column: ${zoomSettings.rootColumns}`);
    assert(zoomSettings.sidebarOverflowX === 'auto', `zoom-200 settings nav should scroll internally instead of clipping the page: ${zoomSettings.sidebarOverflowX}`);
    await capture(client, 'zoom-200-settings');

    await setViewport(client, 1440, 960, false);
    await clickButtonByText(client, '.top-tabs', '편집');
    await waitForBrowser(client, `!!document.querySelector('.builder-shell.edit-mode-shell:not(.mobile-operations-shell)')`, 'desktop editor restored after zoom audit');

    for (let index = 0; index < mobileViewports.length; index += 1) {
      const viewport = mobileViewports[index];
      const keyboardViewport = mobileKeyboardViewports[index];
      await setViewport(client, viewport.width, viewport.height, true);
      await waitForBrowser(client, `!!document.querySelector('.builder-shell.mobile-operations-shell') && !!document.querySelector('.mobile-operations-header')`, `${viewport.name} operations view`);
      const metrics = await collectMobileMetrics(client);
      assertMobile(metrics, viewport);
      await capture(client, viewport.name);

      await focusSelector(client, '.inbox-ops-search input');
      await setViewport(client, keyboardViewport.width, keyboardViewport.height, true);
      await waitForBrowser(client, `!!document.querySelector('.builder-shell.mobile-operations-shell') && document.activeElement === document.querySelector('.inbox-ops-search input')`, `${keyboardViewport.name} focused search`);
      const keyboardMetrics = await evaluate(client, `(() => {
        const rect = (element) => {
          if (!element) return null;
          const box = element.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height };
        };
        const input = document.querySelector('.inbox-ops-search input');
        const workPanel = document.querySelector('.work-panel');
        const tabs = document.querySelector('.top-tabs');
        const rootStyle = getComputedStyle(document.documentElement);
        const fixedOverlap = [...document.querySelectorAll('body *')].some((element) => {
          if (element === input || element.contains(input)) return false;
          const style = getComputedStyle(element);
          if (style.position !== 'fixed' || style.visibility === 'hidden' || style.display === 'none') return false;
          const box = element.getBoundingClientRect();
          const target = input.getBoundingClientRect();
          return box.width > 0 && box.height > 0
            && box.left < target.right && box.right > target.left
            && box.top < target.bottom && box.bottom > target.top;
        });
        return {
          innerHeight,
          visualHeight: Math.round(window.visualViewport?.height || innerHeight),
          cssVisualHeight: parseFloat(rootStyle.getPropertyValue('--pagero-visual-viewport-height')) || 0,
          input: rect(input),
          tabs: rect(tabs),
          workPanelScrollPaddingBottom: parseFloat(getComputedStyle(workPanel).scrollPaddingBottom) || 0,
          active: document.activeElement === input,
          fixedOverlap,
        };
      })()`);
      assert(keyboardMetrics.active, `${keyboardViewport.name} input focus was lost after viewport shrink`);
      assert(keyboardMetrics.input?.top >= -2 && keyboardMetrics.input?.bottom <= keyboardMetrics.innerHeight + 2, `${keyboardViewport.name} focused input is obscured: ${JSON.stringify(keyboardMetrics)}`);
      assert(keyboardMetrics.tabs?.bottom <= keyboardMetrics.input?.top + 2, `${keyboardViewport.name} sticky tabs overlap focused input: ${JSON.stringify(keyboardMetrics)}`);
      assert(!keyboardMetrics.fixedOverlap, `${keyboardViewport.name} fixed UI overlaps focused input`);
      assert(keyboardMetrics.workPanelScrollPaddingBottom >= 96, `${keyboardViewport.name} lacks keyboard-safe scroll padding: ${JSON.stringify(keyboardMetrics)}`);
      assert(Math.abs(keyboardMetrics.cssVisualHeight - keyboardMetrics.visualHeight) <= 2, `${keyboardViewport.name} visual viewport CSS var is stale: ${JSON.stringify(keyboardMetrics)}`);
      await capture(client, keyboardViewport.name);
    }


    qaStep('ED-R11 cross-tab conflict regression');
    // ED-R11: two real Chrome tabs use one simulated server state.
    await setViewport(client, 1440, 960, false);
    await waitForBrowser(client, "!!document.querySelector('.builder-shell:not(.mobile-operations-shell)')", 'tab A desktop editor');
    await clickButtonByText(client, '.top-tabs', '편집');
    await waitForBrowser(client, "!!document.querySelector('#editor-block-editor-hero')", 'tab A hero block');
    const twoTabHeroInput = '#editor-block-editor-hero + .screen-order-v2-inline-editor textarea[placeholder="핵심 제목을 입력하세요"]';
    if (!await evaluate(client, "!!document.querySelector(" + JSON.stringify(twoTabHeroInput) + ")")) {
      await clickSelector(client, '#editor-block-editor-hero .screen-order-v2-head');
    }
    await waitForBrowser(client, "!!document.querySelector(" + JSON.stringify(twoTabHeroInput) + ")", 'tab A hero input');

    const newTarget = await client.send('Target.createTarget', { url: 'about:blank' });
    assert(newTarget.targetId, 'real second Chrome tab must open');
    const openTabs = await fetchJson('http://127.0.0.1:' + debugPort + '/json/list');
    const secondTarget = openTabs.find((item) => item.id === newTarget.targetId && item.webSocketDebuggerUrl);
    assert(secondTarget, 'Chrome must expose the second tab CDP target');
    secondClient = createCdp(secondTarget.webSocketDebuggerUrl);
    secondClient.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      browserErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || 'Second-tab browser exception');
    });
    await secondClient.send('Page.enable');
    secondClient.on('Page.javascriptDialogOpening', (dialog) => {
      if (dialog.type === 'beforeunload') {
        secondClient.send('Page.handleJavaScriptDialog', { accept: true }).catch((error) => {
          browserErrors.push('second tab beforeunload handling: ' + error.message);
        });
      }
    });
    await secondClient.send('Runtime.enable');
    await secondClient.send('Network.enable');
    await secondClient.send('Fetch.enable', { patterns: [{ urlPattern: '*://*/*', requestStage: 'Request' }] });
    createApiMock(secondClient, apiState);
    await secondClient.send('Page.navigate', { url: origin + '/app' });
    await waitForBrowser(secondClient, "!!document.querySelector('.builder-shell:not(.mobile-operations-shell)') && !!document.querySelector('#editor-block-editor-hero')", 'tab B authenticated editor');
    await waitForBrowser(secondClient, "(document.querySelector('.phone-frame')?.innerText || '').includes(" + JSON.stringify(finalHeroTitle) + ")", 'tab B server snapshot');

    apiState.strictRevisionCheck = true;
    const tabASuccessTitle = 'ED-R11 A탭 최신 서버 발행';
    const tabBLocalTitle = 'ED-R11 B탭 미발행 변경';
    if (!await evaluate(secondClient, "!!document.querySelector(" + JSON.stringify(twoTabHeroInput) + ")")) {
      await clickSelector(secondClient, '#editor-block-editor-hero .screen-order-v2-head');
    }
    await waitForBrowser(secondClient, "!!document.querySelector(" + JSON.stringify(twoTabHeroInput) + ")", 'tab B hero input');
    await setInputValue(secondClient, twoTabHeroInput, tabBLocalTitle);
    await waitForBrowser(secondClient, "(document.querySelector('.phone-frame')?.innerText || '').includes(" + JSON.stringify(tabBLocalTitle) + ")", 'tab B local stale edit');

    await setInputValue(client, twoTabHeroInput, tabASuccessTitle);
    await waitForBrowser(client, "(document.querySelector('.phone-frame')?.innerText || '').includes(" + JSON.stringify(tabASuccessTitle) + ")", 'tab A local edit');
    await clickSelector(client, '.panel-actions .primary-btn');
    await waitForState(() => apiState.saveCount === 4, 'tab A newer publish');
    await waitForBrowser(client, "(document.querySelector('.panel-actions .primary-btn')?.textContent || '').includes('발행됨')", 'tab A scoped save success');
    assert(apiState.currentPage.blocks.find((block) => block.id === 'editor-hero')?.s?.title === tabASuccessTitle, 'tab A must become authoritative');

    await clickSelector(secondClient, '.panel-actions .primary-btn');
    await waitForState(() => apiState.revisionConflictCount >= 1, 'tab B stale publish denied');
    await waitForBrowser(secondClient, "!!document.querySelector('.page-conflict-modal[role=dialog]')", 'tab B conflict dialog');
    assert(apiState.saveCount === 4, 'tab B conflict must not count as persisted save');
    assert(apiState.currentPage.blocks.find((block) => block.id === 'editor-hero')?.s?.title === tabASuccessTitle, 'stale tab B must not overwrite A');
    assert(await evaluate(secondClient, "(document.querySelector('.phone-frame')?.innerText || '').includes(" + JSON.stringify(tabBLocalTitle) + ")"), 'tab B local unsaved work must survive conflict');
    await capture(secondClient, 'editor-two-tab-conflict');

    // A real 409 must preserve an isolated browser draft, not merely leave
    // the unsaved text visible in the current React state.
    const conflictDraftBeforeReload = await evaluate(secondClient, `(() => {
      const raw = Object.keys(localStorage).filter((key) => key.includes(':page-conflict-draft:'));
      return raw.some((key) => (localStorage.getItem(key) || '').includes('ED-R11 B탭 미발행 변경'));
    })()`);
    assert(conflictDraftBeforeReload, 'B conflict snapshot must survive in browser localStorage');

    // ED-R11-2: Reload the stale editor and explicitly recover the orphaned
    // per-tab draft. The other tab's latest server revision must stay intact.
    await secondClient.send('Page.reload');
    await waitForBrowser(secondClient, `!!document.querySelector('.builder-shell:not(.mobile-operations-shell)')`, 'tab B reload after conflict');
    await waitForBrowser(secondClient, `!!document.querySelector('.confirm-modal[role="dialog"]') && (document.querySelector('.confirm-modal')?.innerText || '').includes('임시 편집본')`, 'B recovery dialog after reload');
    await clickSelector(secondClient, '.confirm-modal .confirm-primary');
    await waitForBrowser(secondClient, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(tabBLocalTitle)})`, 'B local work recovered after reload');
    assert(apiState.saveCount === 4, 'restoring a conflict draft must not auto-publish');
    const recoveredDraftUnsavedGuard = await evaluate(secondClient, `(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    })()`);
    assert(recoveredDraftUnsavedGuard, 'recovered draft must remain protected until explicitly published');

    // A publishes again after B's recovery, so B's restored work is stale.
    const tabASecondTitle = 'ED-R11 A탭 다시 발행한 최신본';
    await setInputValue(client, twoTabHeroInput, tabASecondTitle);
    await waitForBrowser(client, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(tabASecondTitle)})`, 'tab A second edit');
    await clickSelector(client, '.panel-actions .primary-btn');
    await waitForState(() => apiState.saveCount === 5, 'tab A second publish');

    if (!await evaluate(secondClient, `!!document.querySelector(${JSON.stringify(twoTabHeroInput)})`)) {
      await clickSelector(secondClient, '#editor-block-editor-hero .screen-order-v2-head');
    }
    await clickSelector(secondClient, '.panel-actions .primary-btn');
    await waitForState(() => apiState.revisionConflictCount === 2, 'recovered B draft is stale again');
    await waitForBrowser(secondClient, `!!document.querySelector('.page-conflict-modal[role="dialog"]')`, 'B second conflict');
    await clickButtonByText(secondClient, '.page-conflict-actions', '최신본 불러오기');
    await waitForBrowser(secondClient, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(tabASecondTitle)})`, 'B explicitly adopts A latest');
    assert(apiState.saveCount === 5, 'adopting latest server version must not publish');
    const latestLoadGuard = await evaluate(secondClient, `(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    })()`);
    assert(!latestLoadGuard, 'choosing server latest must clear unsaved navigation guard');
    const archivedConflictSnapshot = await evaluate(secondClient, `Object.keys(localStorage).some((key) =>
      key.includes(':page-conflict-draft:') &&
      (localStorage.getItem(key) || '').includes('ED-R11 B탭 미발행 변경')
    )`);
    assert(archivedConflictSnapshot, 'explicit latest choice must not delete recoverable conflict snapshot');

    // ED-R11-3: user explicitly selects "my work" after another conflicting
    // save. The local page must be rebased to the newest server revision before
    // overwrite, and successful resolution must leave a clean page.
    const tabBFinalTitle = 'ED-R11 B탭 충돌 해결 재발행';
    const tabAThirdTitle = 'ED-R11 A탭 세 번째 최신본';
    await setInputValue(secondClient, twoTabHeroInput, tabBFinalTitle);
    await waitForBrowser(secondClient, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(tabBFinalTitle)})`, 'B final work before conflict');
    await setInputValue(client, twoTabHeroInput, tabAThirdTitle);
    await waitForBrowser(client, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(tabAThirdTitle)})`, 'A third work before publish');
    await clickSelector(client, '.panel-actions .primary-btn');
    await waitForState(() => apiState.saveCount === 6, 'A third publish');
    await clickSelector(secondClient, '.panel-actions .primary-btn');
    await waitForState(() => apiState.revisionConflictCount === 3, 'B third stale write rejected');
    await waitForBrowser(secondClient, `!!document.querySelector('.page-conflict-modal[role="dialog"]')`, 'B third conflict dialog');
    await clickButtonByText(secondClient, '.page-conflict-actions', '내 작업으로 저장');
    await waitForState(() => apiState.saveCount === 7, 'B user-approved overwrite publishes');
    await waitForBrowser(secondClient, `!document.querySelector('.page-conflict-modal[role="dialog"]')`, 'B conflict dialog closes after verified save');
    assert(apiState.currentPage.blocks.find((block) => block.id === 'editor-hero')?.s?.title === tabBFinalTitle, 'B approved overwrite must become authoritative');
    await waitForBrowser(secondClient, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(tabBFinalTitle)})`, 'B editor reads its approved publication');
    const overwriteGuard = await evaluate(secondClient, `(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    })()`);
    assert(!overwriteGuard, 'verified overwrite must clear unsaved navigation guard');
    await capture(secondClient, 'editor-two-tab-conflict-recovered-and-published');



    assert(!apiState.interceptError, `API interception failed: ${apiState.interceptError?.message || apiState.interceptError}`);
    assert(apiState.unexpectedApis.length === 0, `Unexpected API requests: ${apiState.unexpectedApis.join(', ')}`);
    if (browserErrors.length) {
      // Diagnostic only on regression failure: map the first minified stack
      // frame back to its surrounding public frontend bundle source.
      const firstFrame = browserErrors[0].match(/(https?:\/\/[^\s)]+\.js):(\d+):(\d+)/);
      if (firstFrame) {
        const [,, lineText, columnText] = firstFrame;
        const bundleExcerpt = await evaluate(client, `(async () => {
          const raw = await fetch(${JSON.stringify(firstFrame[1])}).then((response) => response.text());
          const scriptLine = raw.split(String.fromCharCode(10))[${Number(lineText) - 1}] || '';
          return scriptLine.slice(Math.max(0, ${Number(columnText)} - 320), ${Number(columnText)} + 400);
        })()`);
        console.error('ED-R11 browser exception bundle excerpt:', bundleExcerpt);
      }
    }
    assert(browserErrors.length === 0, `Browser exceptions: ${browserErrors.join('\n')}`);

    console.log(JSON.stringify({
      ok: true,
      scope: 'authenticated-editor-browser-regression',
      stageOneBlockList: stageOneList,
      customCodePreview: ['html-css-visible', 'javascript-click', 'dynamic-height', 'parent-session-isolated', 'api-write-blocked'],
      loginCount: apiState.loginCount,
      sessionCount: apiState.sessionCount,
      projectListCount: apiState.projectListCount,
      pageLoadCount: apiState.pageLoadCount,
      saveCount: apiState.saveCount,
      saveRaceProtected: apiState.saveSnapshots[1]?.blocks?.find((block) => block.id === 'editor-hero')?.s?.title === continuedHeroTitle,
      portableFileDownloadAndRestore: true,
      wrongPageBackupBlocked: true,
      restoredUnsavedGuard,
      realTwoTabConflictProtected: apiState.revisionConflictCount === 3 && apiState.saveCount === 7,
      conflictDraftReloadRecovered: recoveredDraftUnsavedGuard && conflictDraftBeforeReload,
      latestVersionChosenCleanly: !latestLoadGuard && archivedConflictSnapshot,
      approvedConflictOverwritePublished: !overwriteGuard && apiState.currentPage.blocks.find((block) => block.id === 'editor-hero')?.s?.title === tabBFinalTitle,
      normalReloadServerReadback: apiState.pageLoadCount > pageLoadsBeforeReload,
      cleanAfterReload: reloadGuardPrevented === false,
      revisionListCount: apiState.revisionListCount,
      revisionRestoreUndoRedo: apiState.currentPage.blocks.find((block) => block.id === 'editor-hero')?.s?.title === finalHeroTitle,
      publicVerifyCount: apiState.publicVerifyCount,
      desktopWidths: desktopMatrix.map((item) => item.width),
      mobileWidths: mobileViewports.map((item) => item.width),
      mobileKeyboardWidths: mobileKeyboardViewports.map((item) => item.width),
      mobileKeyboardHeight: 360,
      responsiveMatrixScreenshots: desktopMatrix.length + zoom200Matrix.length + mobileViewports.length + mobileKeyboardViewports.length + 2,
      responsiveGeometryLocked: true,
      zoom200P93: ['desktop-builder-preserved', 'no-page-horizontal-scroll', 'add-dock-no-fixed-overlap', 'settings-single-column-reflow'],
      conversionCockpit: false,
      publishChecklist: true,
      keyboardOnlyP91: ['Enter', 'Space', 'Tab', 'Shift+Tab', 'Escape'],
      focusManagementP92: ['modal-trap', 'modal-return', 'workspace-transition-recovery'],
      mobileKeyboardP96: ['360', '390', '430', 'focused-input-visible', 'modal-actions-visible', 'no-fixed-overlap'],
      realUseFlows: ['focus-recovery-workspace-transition', 'modal-focus-trap-return', 'keyboard-row-activation', 'keyboard-dropdown', 'add-block', 'undo-redo', 'visibility', 'menu-reorder', 'pointer-drag-reorder', 'style-apply', 'preview-continue', 'publish-race', 'revision-restore-undo-redo', 'post-restore-publish-readback', 'narrow-desktop'],
    }, null, 2));
  } finally {
    console.log('[editor-qa] cleanup at:', activeQaStep);
    await secondClient?.close().catch(() => {});
    await client?.close().catch(() => {});
    if (child && !child.killed) child.kill('SIGTERM');
    await rm(profileDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
}

await run();
