import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
const updatedAccent = '#7c3aed';
const mobileViewports = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const response = await fetch(url, init);
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
    if (payload.method) {
      for (const listener of listeners.get(payload.method) || []) listener(payload.params || {});
    }
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

function createApiMock(client) {
  const user = createQaUser();
  const state = {
    currentPage: createQaPage(),
    loginCount: 0,
    sessionCount: 0,
    projectListCount: 0,
    pageLoadCount: 0,
    publicVerifyCount: 0,
    saveCount: 0,
    saveDelayMs: 0,
    saveSnapshots: [],
    revisionListCount: 0,
    leadLoadCount: 0,
    loginBody: null,
    unexpectedApis: [],
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
  const points = await evaluate(client, `(() => {
    const source = document.querySelector(${JSON.stringify(sourceSelector)});
    const target = document.querySelector(${JSON.stringify(targetSelector)});
    if (!source || !target) return null;
    source.scrollIntoView({ block: 'center', inline: 'center' });
    target.scrollIntoView({ block: 'center', inline: 'center' });
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return {
      source: { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 },
      target: { x: targetRect.left + targetRect.width / 2, y: targetRect.top + Math.max(2, targetRect.height / 2) },
    };
  })()`);
  assert(points?.source && points?.target, `Unable to resolve drag geometry: ${sourceSelector} -> ${targetSelector}`);

  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: points.source.x, y: points.source.y });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: points.source.x, y: points.source.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let step = 1; step <= 8; step += 1) {
    const ratio = step / 8;
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: points.source.x + (points.target.x - points.source.x) * ratio,
      y: points.source.y + (points.target.y - points.source.y) * ratio,
      button: 'left',
      buttons: 1,
    });
    await wait(45);
  }
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: points.target.x, y: points.target.y, button: 'left', buttons: 0, clickCount: 1 });
  await wait(250);
}

async function capture(client, name) {
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
      preview: rect(document.querySelector('.preview-workspace')),
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
    const tabs = document.querySelector('.workspace-tabs');
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
  assert(metrics.text.includes('모바일 운영'), `${viewport.name} mobile operations heading is missing`);
  assert(metrics.text.includes('접수함') && metrics.text.includes('통계'), `${viewport.name} operations tabs are missing`);
}

async function run() {
  const chrome = resolveChrome();
  assert(chrome, 'Chrome or Chromium executable was not found');
  await mkdir(screenshotDir, { recursive: true });
  const profileDir = await mkdtemp(path.join(tmpdir(), 'inlet-editor-browser-'));
  const browserErrors = [];
  let child = null;
  let client = null;

  try {
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
    child.stderr?.on('data', () => {});

    await waitForChrome(debugPort);
    const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
    const target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
    assert(target, 'Chrome page target was not found');

    client = createCdp(target.webSocketDebuggerUrl);
    client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      browserErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || 'Browser exception');
    });

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    await client.send('Fetch.enable', { patterns: [{ urlPattern: '*://*/*', requestStage: 'Request' }] });
    const apiState = createApiMock(client);

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
    await capture(client, 'desktop-editor-before');

    const heroEditorSelector = '.screen-order-v2-settings-panel textarea[placeholder="핵심 제목을 입력하세요"]';
    await clickSelector(client, '#editor-block-editor-hero .screen-order-v2-head');
    await waitForBrowser(client, `!!document.querySelector(${JSON.stringify(heroEditorSelector)})`, 'separate hero editor textarea');
    const inlineEditorStillNested = await evaluate(client, `!!document.querySelector('#editor-block-editor-hero textarea[placeholder="핵심 제목을 입력하세요"]')`);
    assert(!inlineEditorStillNested, 'screen order row must not contain the block detail editor');
    await setInputValue(client, heroEditorSelector, updatedHeroTitle);
    await waitForBrowser(client, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(updatedHeroTitle)})`, 'live hero preview');
    await wait(250);
    assert(apiState.saveCount === 0, 'editing must not submit a server save before the save button is pressed');

    // E2E-02 / E2E-03: add a real block, then undo and redo the add operation.
    const initialNormalBlockCount = await normalBlockCount(client);
    await clickSelector(client, '.add-toggle');
    await waitForBrowser(client, `!!document.querySelector('#pagero-widget-search')`, 'block add panel');
    await setInputValue(client, '#pagero-widget-search', '구분선');
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

    // E2E-11 / E2E-12: style draft previews first, then apply into the page draft.
    await clickButtonByText(client, '.top-tabs', '스타일');
    await waitForBrowser(client, `!!document.querySelector('.style-panel')`, 'style panel');
    await clickButtonByText(client, '.style-subnav', '색상');
    await waitForBrowser(client, `!!document.querySelector('.style-panel input[type="color"]')`, 'style accent input');
    await setInputValue(client, '.style-panel input[type="color"]', updatedAccent);
    await waitForBrowser(client, `!document.querySelector('.style-apply-btn')?.disabled`, 'style apply enabled');
    assert(apiState.saveCount === 0, 'style preview must not publish automatically');
    await clickSelector(client, '.style-apply-btn');
    await waitForBrowser(client, `document.querySelector('.style-apply-btn')?.disabled === true`, 'style applied to page draft');

    await clickButtonByText(client, '.top-tabs', '편집');
    await waitForBrowser(client, `!!document.querySelector('.screen-order-v2-list')`, 'edit panel after style apply');

    // E2E-13: preview action must not close or freeze the editor; continue editing afterwards.
    await evaluate(client, `window.__pageroQaPreviewCalls = []; window.open = (...args) => { window.__pageroQaPreviewCalls.push(args); return { opener: null }; };`);
    await clickButtonByText(client, '.panel-actions', '미리보기');
    await waitForBrowser(client, `window.__pageroQaPreviewCalls?.length === 1`, 'preview window request');
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
    assert(apiState.saveSnapshots[0]?.theme?.accent === updatedAccent, 'style change was not included in the first publish snapshot');

    await waitForState(() => apiState.saveCount >= 2, 'automatic trailing publish');
    assert(apiState.saveCount === 2, `pending edit should require exactly one automatic trailing save, got ${apiState.saveCount}`);
    assert(apiState.saveSnapshots[1]?.blocks?.find((block) => block.id === 'editor-hero')?.s?.title === continuedHeroTitle, 'automatic trailing save did not capture the latest hero title');
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
    await clickButtonByText(client, '.settings-mode-switch', '고급 설정');
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

    await clickSelector(client, '.panel-actions .primary-btn');
    await waitForState(() => apiState.saveCount === 3, 'publish restored revision with additional edit');
    await waitForState(() => apiState.publicVerifyCount >= 2, 'public verification after revision publish');
    assert(apiState.saveSnapshots[2]?.blocks?.find((block) => block.id === 'editor-hero')?.s?.title === finalHeroTitle, 'revision publish snapshot did not include the final hero title');
    assert(apiState.currentPage.blocks.find((block) => block.id === 'editor-hero')?.s?.title === finalHeroTitle, 'server page did not keep the final post-restore edit');

    await client.send('Page.reload', { ignoreCache: true });
    await waitForBrowser(client, `!!document.querySelector('.builder-shell:not(.mobile-operations-shell)') && !!document.querySelector('.phone-frame')`, 'reloaded desktop editor');
    await waitForBrowser(client, `(document.querySelector('.phone-frame')?.innerText || '').includes(${JSON.stringify(finalHeroTitle)})`, 'saved page after reload');
    assert(apiState.sessionCount >= 1, 'saved login session was not refreshed after reload');
    const desktopMetrics = await collectDesktopMetrics(client);
    assertDesktop(desktopMetrics);
    await capture(client, 'desktop-editor-reloaded');

    await setViewport(client, 1180, 900, false);
    await waitForBrowser(client, `!!document.querySelector('.builder-shell:not(.mobile-operations-shell)') && !!document.querySelector('.preview-workspace')`, 'narrow desktop editor');
    const narrowDesktopMetrics = await collectNarrowDesktopMetrics(client);
    assertNarrowDesktop(narrowDesktopMetrics, 1180);
    await capture(client, 'desktop-narrow-1180');

    for (const viewport of mobileViewports) {
      await setViewport(client, viewport.width, viewport.height, true);
      await waitForBrowser(client, `!!document.querySelector('.builder-shell.mobile-operations-shell') && !!document.querySelector('.mobile-operations-header')`, `${viewport.name} operations view`);
      const metrics = await collectMobileMetrics(client);
      assertMobile(metrics, viewport);
      await capture(client, viewport.name);
    }

    assert(!apiState.interceptError, `API interception failed: ${apiState.interceptError?.message || apiState.interceptError}`);
    assert(apiState.unexpectedApis.length === 0, `Unexpected API requests: ${apiState.unexpectedApis.join(', ')}`);
    assert(browserErrors.length === 0, `Browser exceptions: ${browserErrors.join('\n')}`);

    console.log(JSON.stringify({
      ok: true,
      scope: 'authenticated-editor-browser-regression',
      loginCount: apiState.loginCount,
      sessionCount: apiState.sessionCount,
      projectListCount: apiState.projectListCount,
      pageLoadCount: apiState.pageLoadCount,
      saveCount: apiState.saveCount,
      saveRaceProtected: apiState.saveSnapshots[1]?.blocks?.find((block) => block.id === 'editor-hero')?.s?.title === continuedHeroTitle,
      revisionListCount: apiState.revisionListCount,
      revisionRestoreUndoRedo: apiState.currentPage.blocks.find((block) => block.id === 'editor-hero')?.s?.title === finalHeroTitle,
      publicVerifyCount: apiState.publicVerifyCount,
      mobileWidths: mobileViewports.map((item) => item.width),
      screenshots: 7,
      realUseFlows: ['add-block', 'undo-redo', 'visibility', 'menu-reorder', 'pointer-drag-reorder', 'style-apply', 'preview-continue', 'publish-race', 'revision-restore-undo-redo', 'post-restore-publish-readback', 'narrow-desktop'],
    }, null, 2));
  } finally {
    await client?.close().catch(() => {});
    if (child && !child.killed) child.kill('SIGTERM');
    await rm(profileDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
}

await run();
