import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const targetOrigin = String(process.env.INLET_BROWSER_QA_ORIGIN || 'http://127.0.0.1:4173').replace(/\/$/, '');
const targetUrl = `${targetOrigin}/visual-regression`;
const screenshotDir = process.env.INLET_BROWSER_QA_SCREENSHOT_DIR || '.tmp-landing-browser-regression';
const chromeDebugPort = Number(process.env.INLET_BROWSER_QA_CHROME_PORT || 9337);
const chromePathInput = String(process.env.INLET_BROWSER_QA_CHROME_PATH || '').trim();

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000, mobile: false },
  { name: 'mobile-360', width: 360, height: 800, mobile: true },
  { name: 'mobile-390', width: 390, height: 844, mobile: true },
  { name: 'mobile-430', width: 430, height: 932, mobile: true },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function resolveChromePath() {
  const candidates = [
    chromePathInput,
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
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || '';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function waitForBrowserEndpoint(port) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < 15000) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await wait(200);
    }
  }
  throw new Error(`Chrome debugging endpoint did not start: ${lastError?.message || 'unknown error'}`);
}

function createCdpClient(webSocketUrl) {
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
    on(method, callback) {
      listeners.set(method, [...(listeners.get(method) || []), callback]);
    },
    async close() {
      await opened.catch(() => {});
      socket.close();
    },
  };
}

function visualRegressionPage() {
  const menus = Array.from({ length: 7 }, (_, index) => ({
    id: `visual-menu-${index + 1}`,
    label: index === 5 ? '상담 신청 안내' : `메뉴 ${index + 1}`,
    target: `visual-section-${index + 1}`,
  }));
  return {
    id: 'visual-regression-page',
    projectId: 'visual-regression-project',
    ownerId: 'visual-regression-owner',
    title: '시각 회귀 테스트 페이지',
    slug: 'visual-regression',
    status: 'published',
    revision: 1,
    updatedAt: '2026-07-30T00:00:00.000Z',
    share: { enabled: true, position: 'bottom-right' },
    theme: {
      accent: '#2563eb',
      bgMode: 'solid',
      bg: '#eef2f7',
      card: '#ffffff',
      text: '#111827',
      radius: 22,
      font: 'medium',
      fontFamily: 'pretendard',
      globalAlign: 'left',
      animOn: false,
      animType: 'fade',
      buttonEffect: 'fill',
    },
    blocks: [
      {
        id: 'visual-topnav',
        type: 'topnav',
        visible: true,
        s: {
          logoText: 'VR',
          logoStyle: 'badge',
          logoSize: 'small',
          menuStyle: 'pill',
          menuSize: 'small',
          bg: 'white',
          align: 'left',
          sticky: true,
          menusV2: menus,
          menus,
        },
      },
      {
        id: 'visual-hero',
        type: 'hero',
        visible: true,
        s: {
          anchorId: 'visual-section-1',
          title: '시각 회귀 테스트 페이지',
          subtitle: '상단 메뉴, 타이머, 폼, 공유 버튼과 하단 고정바를 실제 브라우저에서 검사합니다.',
          ctaLabel: '상담 신청',
          ctaTarget: 'visual-form',
          align: 'left',
        },
      },
      {
        id: 'visual-timer',
        type: 'timer',
        visible: true,
        s: {
          anchorId: 'visual-section-2',
          label: '신청 마감까지',
          promoBadge: '마감 임박',
          repeatMode: 'daily24',
          timerVariant: 'block',
          timerPalette: 'blue',
          timerEffect: 'none',
          timerMotion: false,
          done: '신청이 마감되었습니다.',
        },
      },
      {
        id: 'visual-form',
        type: 'form',
        visible: true,
        s: {
          anchorId: 'visual-section-3',
          title: '상담 신청',
          desc: '입력 중 고정 UI가 현재 필드를 가리지 않아야 합니다.',
          style: 'card',
          inputStyle: 'round',
          buttonStyle: 'solid',
          questions: [
            { id: 'visual-name', type: 'name', label: '이름', required: true },
            { id: 'visual-phone', type: 'phone', label: '연락처', required: true },
          ],
          privacy: '개인정보 수집 및 이용에 동의합니다.',
          privacyRequired: true,
          submit: '신청하기',
        },
      },
      {
        id: 'visual-text',
        type: 'text',
        visible: true,
        s: {
          anchorId: 'visual-section-4',
          title: '하단 여백 확인',
          body: '본문 마지막 콘텐츠가 하단 고정 버튼에 가려지지 않아야 합니다.',
          layout: 'card',
        },
      },
      {
        id: 'visual-footer',
        type: 'footer',
        visible: true,
        s: { company: '페이지로 시각 테스트', owner: 'QA', phone: '010-0000-0000', bg: 'soft', align: 'center' },
      },
      {
        id: 'visual-bottom',
        type: 'bottombar',
        visible: true,
        s: {
          timerEnabled: true,
          count: 2,
          style: 'pill',
          color: 'dark',
          buttons: [
            { id: 'visual-bottom-1', enabled: true, icon: '💬', label: '상담', target: 'visual-form', url: '' },
            { id: 'visual-bottom-2', enabled: true, icon: '☎️', label: '전화', target: 'phone', url: 'tel:01000000000' },
          ],
        },
      },
    ],
  };
}

function browserInitScript() {
  const page = visualRegressionPage();
  return `(() => {
    const visualPage = ${JSON.stringify(page)};
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const rawUrl = typeof input === 'string' ? input : input?.url || '';
      const url = new URL(rawUrl, location.origin);
      const method = String(init?.method || 'GET').toUpperCase();
      if (url.pathname === '/api/pages/visual-regression' && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, page: visualPage }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        }));
      }
      if (url.pathname.startsWith('/api/events') && method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }));
      }
      return originalFetch(input, init);
    };
  })();`;
}

async function waitForLanding(client) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < 15000) {
    const result = await client.send('Runtime.evaluate', {
      expression: `(() => ({
        ready: !!document.querySelector('.public-landing-viewport .landing-page')
          && !!document.querySelector('.public-landing-viewport .topnav')
          && !!document.querySelector('.public-bottom-bar'),
        text: (document.body?.innerText || '').slice(0, 300),
      }))()`,
      returnByValue: true,
    });
    last = result.result?.value || null;
    if (last?.ready) return;
    await wait(250);
  }
  throw new Error(`Landing page did not become ready: ${JSON.stringify(last)}`);
}

async function collectMetrics(client) {
  const result = await client.send('Runtime.evaluate', {
    expression: String.raw`(() => {
      const rect = (element) => {
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
      };
      const styleState = (element) => {
        if (!element) return null;
        const style = getComputedStyle(element);
        return { opacity: Number(style.opacity || 1), visibility: style.visibility, pointerEvents: style.pointerEvents, display: style.display };
      };
      const viewport = document.querySelector('.public-landing-viewport');
      const landing = document.querySelector('.public-landing-viewport .landing-page');
      const topnav = document.querySelector('.public-landing-viewport .topnav');
      const menuSet = document.querySelector('.public-landing-viewport .top-menu-set');
      const menuButtons = Array.from(document.querySelectorAll('.public-landing-viewport .top-menu-set > button'));
      const timer = document.querySelector('.public-landing-viewport .landing-section.timer');
      const share = document.querySelector('.public-landing-viewport .page-share-button');
      const bottom = document.querySelector('.public-bottom-bar');
      const formInput = document.querySelector('.public-landing-viewport .landing-section.form input[type="text"], .public-landing-viewport .landing-section.form input:not([type])');
      const rows = [];
      for (const button of menuButtons) {
        const box = button.getBoundingClientRect();
        let row = rows.find((item) => Math.abs(item.top - box.top) <= 3);
        if (!row) {
          row = { top: box.top, widths: [] };
          rows.push(row);
        }
        row.widths.push(box.width);
      }
      rows.sort((a, b) => a.top - b.top);
      return {
        viewportWidth: window.innerWidth,
        bodyScrollWidth: document.body?.scrollWidth || 0,
        documentScrollWidth: document.documentElement?.scrollWidth || 0,
        viewport: rect(viewport),
        landing: rect(landing),
        topnav: rect(topnav),
        menuSet: rect(menuSet),
        timer: rect(timer),
        share: rect(share),
        bottom: rect(bottom),
        menuButtonRects: menuButtons.map(rect),
        menuRowSizes: rows.map((row) => row.widths.length),
        menuRowWidthSpreads: rows.map((row) => Math.max(...row.widths) - Math.min(...row.widths)),
        topnavState: styleState(topnav),
        shareState: styleState(share),
        bottomState: styleState(bottom),
        inputExists: !!formInput,
        appError: /화면을 불러오는 중 오류가 발생했습니다|페이지를 찾을 수 없습니다/.test(document.body?.innerText || ''),
        fallbackVisible: !!document.querySelector('.block-render-fallback, .app-error-screen, .error-screen'),
      };
    })()`,
    returnByValue: true,
  });
  return result.result?.value || {};
}

function assertInside(child, parent, label, tolerance = 3) {
  assert(child && parent, `${label} bounds are missing`);
  assert(child.left >= parent.left - tolerance, `${label} spills left: ${JSON.stringify({ child, parent })}`);
  assert(child.right <= parent.right + tolerance, `${label} spills right: ${JSON.stringify({ child, parent })}`);
}

function assertVisibleState(state, label) {
  assert(state, `${label} style state is missing`);
  assert(state.display !== 'none', `${label} is display:none in baseline`);
  assert(state.visibility !== 'hidden', `${label} is hidden in baseline`);
  assert(state.opacity > 0.5, `${label} opacity is too low in baseline: ${state.opacity}`);
}

function assertHiddenState(state, label) {
  assert(state, `${label} style state is missing`);
  const hidden = state.display === 'none' || state.visibility === 'hidden' || state.opacity <= 0.05;
  assert(hidden, `${label} must hide while a form input is focused: ${JSON.stringify(state)}`);
  assert(state.pointerEvents === 'none' || state.display === 'none', `${label} must not capture pointer input while hidden`);
}

function assertBaseline(metrics, viewport) {
  assert(!metrics.appError, `${viewport.name} rendered an app/public-page error`);
  assert(!metrics.fallbackVisible, `${viewport.name} rendered a block fallback`);
  assert(metrics.bodyScrollWidth <= viewport.width + 3, `${viewport.name} body horizontal overflow: ${metrics.bodyScrollWidth} > ${viewport.width}`);
  assert(metrics.documentScrollWidth <= viewport.width + 3, `${viewport.name} document horizontal overflow: ${metrics.documentScrollWidth} > ${viewport.width}`);
  assert(metrics.viewport?.width <= 414.5, `${viewport.name} public viewport exceeded 414px: ${metrics.viewport?.width}`);
  assert(metrics.viewport?.width <= viewport.width + 1, `${viewport.name} public viewport exceeded browser width`);
  assertInside(metrics.landing, metrics.viewport, `${viewport.name} landing`);
  assertInside(metrics.topnav, metrics.landing, `${viewport.name} top navigation`);
  assertInside(metrics.timer, metrics.landing, `${viewport.name} timer`);
  assertInside(metrics.bottom, metrics.viewport, `${viewport.name} bottom bar`);
  assertInside(metrics.menuSet, metrics.topnav, `${viewport.name} menu set`, 6);
  assert(metrics.menuButtonRects?.length === 7, `${viewport.name} expected 7 menu buttons, got ${metrics.menuButtonRects?.length || 0}`);
  for (const [index, button] of (metrics.menuButtonRects || []).entries()) {
    assertInside(button, metrics.menuSet, `${viewport.name} menu button ${index + 1}`, 4);
    assert(button.height >= 43, `${viewport.name} menu button ${index + 1} touch height is below 44px: ${button.height}`);
  }
  assert(JSON.stringify(metrics.menuRowSizes) === JSON.stringify([4, 3]), `${viewport.name} menu rows must be 4+3, got ${JSON.stringify(metrics.menuRowSizes)}`);
  assert((metrics.menuRowWidthSpreads || []).every((spread) => spread <= 3), `${viewport.name} menu widths are uneven: ${JSON.stringify(metrics.menuRowWidthSpreads)}`);
  assertVisibleState(metrics.topnavState, `${viewport.name} top navigation`);
  assertVisibleState(metrics.shareState, `${viewport.name} share button`);
  assertVisibleState(metrics.bottomState, `${viewport.name} bottom bar`);
  assert(metrics.share && metrics.bottom && metrics.share.bottom <= metrics.bottom.top - 4, `${viewport.name} share button overlaps bottom bar`);
  assert(metrics.inputExists, `${viewport.name} form input is missing`);
}

async function focusFormInput(client) {
  const result = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.public-landing-viewport .landing-section.form input[type="text"], .public-landing-viewport .landing-section.form input:not([type])');
      if (!input) return false;
      input.scrollIntoView({ block: 'center' });
      input.focus();
      input.dispatchEvent(new Event('focusin', { bubbles: true }));
      return document.activeElement === input;
    })()`,
    returnByValue: true,
  });
  assert(result.result?.value === true, 'Could not focus the visual-regression form input');
  await wait(350);
}

async function screenshot(client, file) {
  const captured = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(file, Buffer.from(captured.data, 'base64'));
  const info = await stat(file);
  assert(info.size > 2000, `Screenshot is too small: ${file}`);
}

async function openTarget(port, initScript, viewport, errors) {
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  const client = createCdpClient(target.webSocketDebuggerUrl);
  client.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') errors.push((params.args || []).map((arg) => arg.value || arg.description || '').join(' '));
  });
  client.on('Runtime.exceptionThrown', (params) => errors.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'page exception'));
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: initScript });
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await client.send('Page.navigate', { url: targetUrl });
  await waitForLanding(client);
  await wait(500);
  return { client, target };
}

async function closeTarget(port, client, target) {
  await client.close().catch(() => {});
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
}

const chromeExecutable = resolveChromePath();
assert(chromeExecutable, 'Chrome/Chromium executable not found. Set INLET_BROWSER_QA_CHROME_PATH.');
await mkdir(screenshotDir, { recursive: true });
const browserUserDataDir = await mkdtemp(path.join(tmpdir(), 'inlet-landing-browser-qa-'));
const browserErrors = [];
const browser = spawn(chromeExecutable, [
  '--headless=new',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  `--remote-debugging-port=${chromeDebugPort}`,
  `--user-data-dir=${browserUserDataDir}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
browser.stderr?.on('data', (chunk) => {
  const text = String(chunk).trim();
  if (text) browserErrors.push(text);
});

const results = [];
try {
  await waitForBrowserEndpoint(chromeDebugPort).catch((error) => {
    throw new Error(`${error.message}; chrome stderr: ${browserErrors.slice(-6).join(' | ')}`);
  });
  const initScript = browserInitScript();
  for (const viewport of VIEWPORTS) {
    const errors = [];
    const { client, target } = await openTarget(chromeDebugPort, initScript, viewport, errors);
    try {
      const metrics = await collectMetrics(client);
      assert(!errors.length, `${viewport.name} console/runtime errors: ${errors.join(' | ')}`);
      assertBaseline(metrics, viewport);
      const file = path.join(screenshotDir, `${viewport.name}-baseline.png`);
      await screenshot(client, file);
      results.push({ scenario: 'baseline', viewport: viewport.name, file, metrics });

      if (viewport.name === 'mobile-390') {
        await focusFormInput(client);
        const focusedMetrics = await collectMetrics(client);
        assertHiddenState(focusedMetrics.topnavState, 'focused top navigation');
        assertHiddenState(focusedMetrics.shareState, 'focused share button');
        assertHiddenState(focusedMetrics.bottomState, 'focused bottom bar');
        const focusedFile = path.join(screenshotDir, `${viewport.name}-form-focus.png`);
        await screenshot(client, focusedFile);
        results.push({ scenario: 'form-focus', viewport: viewport.name, file: focusedFile, metrics: focusedMetrics });
      }
    } finally {
      await closeTarget(chromeDebugPort, client, target);
    }
  }
} finally {
  browser.kill('SIGTERM');
  await wait(500);
  if (!browser.killed) browser.kill('SIGKILL');
  await rm(browserUserDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}

assert(results.length === VIEWPORTS.length + 1, `Expected ${VIEWPORTS.length + 1} visual results, got ${results.length}`);
console.log(JSON.stringify({
  ok: true,
  engine: 'chrome-cdp',
  chromeExecutable,
  targetUrl,
  screenshotDir,
  viewports: VIEWPORTS,
  results: results.map(({ scenario, viewport, file, metrics }) => ({
    scenario,
    viewport,
    file,
    menuRows: metrics.menuRowSizes,
    viewportWidth: metrics.viewport?.width,
    landingWidth: metrics.landing?.width,
    bottomWidth: metrics.bottom?.width,
  })),
}, null, 2));
