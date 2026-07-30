import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { STORAGE_KEY } from '../src/config/storageKeys.js';

const origin = String(process.env.INLET_BROWSER_QA_ORIGIN || 'http://127.0.0.1:4173').replace(/\/$/, '');
const targetUrl = `${origin}/visual-regression`;
const screenshotDir = process.env.INLET_BROWSER_QA_SCREENSHOT_DIR || '.tmp-landing-browser-regression';
const debugPort = Number(process.env.INLET_BROWSER_QA_CHROME_PORT || 9337);
const chromeInput = String(process.env.INLET_BROWSER_QA_CHROME_PATH || '').trim();
const viewports = [
  { name: 'desktop', width: 1440, height: 1000, mobile: false },
  { name: 'mobile-360', width: 360, height: 800, mobile: true },
  { name: 'mobile-390', width: 390, height: 844, mobile: true },
  { name: 'mobile-430', width: 430, height: 932, mobile: true },
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

function createQaPage() {
  const menus = Array.from({ length: 7 }, (_, index) => ({
    id: `visual-menu-${index + 1}`,
    label: index === 5 ? '상담 신청 안내' : `메뉴 ${index + 1}`,
    target: `visual-section-${index + 1}`,
    url: '',
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

function initScript() {
  return `localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(${JSON.stringify(createQaPage())}));`;
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, returnByValue: true });
  return result.result?.value;
}

async function waitForLanding(client) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < 15000) {
    last = await evaluate(client, `(() => ({
      ready: !!document.querySelector('.public-landing-viewport .landing-page')
        && !!document.querySelector('.public-landing-viewport .topnav')
        && !!document.querySelector('.public-bottom-bar'),
      text: (document.body?.innerText || '').slice(0, 300),
    }))()`);
    if (last?.ready) return;
    await wait(250);
  }
  throw new Error(`Landing page did not become ready: ${JSON.stringify(last)}`);
}

async function collectMetrics(client) {
  return evaluate(client, String.raw`(() => {
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const state = (element) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return { opacity: Number(style.opacity || 1), visibility: style.visibility, pointerEvents: style.pointerEvents, display: style.display };
    };
    const viewport = document.querySelector('.public-landing-viewport');
    const landing = document.querySelector('.public-landing-viewport .landing-page');
    const topnav = document.querySelector('.public-landing-viewport .topnav');
    const menuSet = document.querySelector('.public-landing-viewport .top-menu-set');
    const buttons = Array.from(document.querySelectorAll('.public-landing-viewport .top-menu-set > button'));
    const timer = document.querySelector('.public-landing-viewport .landing-section.timer');
    const share = document.querySelector('.public-landing-viewport .page-share-button');
    const bottom = document.querySelector('.public-bottom-bar');
    const active = document.activeElement;
    const rows = [];
    for (const button of buttons) {
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
      bodyScrollWidth: document.body?.scrollWidth || 0,
      documentScrollWidth: document.documentElement?.scrollWidth || 0,
      viewport: rect(viewport),
      landing: rect(landing),
      topnav: rect(topnav),
      menuSet: rect(menuSet),
      timer: rect(timer),
      share: rect(share),
      bottom: rect(bottom),
      menuButtons: buttons.map(rect),
      menuRows: rows.map((row) => row.widths.length),
      menuWidthSpreads: rows.map((row) => Math.max(...row.widths) - Math.min(...row.widths)),
      topnavState: state(topnav),
      shareState: state(share),
      bottomState: state(bottom),
      activeTag: active?.tagName || '',
      activeType: active?.getAttribute?.('type') || '',
      activeWithinForm: !!active?.closest?.('.landing-section.form'),
      formFocusWithin: !!document.querySelector('.landing-section.form:focus-within'),
      landingClass: landing?.className || '',
      inputExists: !!document.querySelector('.public-landing-viewport .landing-section.form input'),
      appError: /화면을 불러오는 중 오류가 발생했습니다|페이지를 찾을 수 없습니다|로컬 저장 페이지와 URL이 일치하지 않습니다/.test(document.body?.innerText || ''),
      fallback: !!document.querySelector('.block-render-fallback, .app-error-screen, .error-screen'),
    };
  })()`);
}

function assertInside(child, parent, label, tolerance = 3) {
  assert(child && parent, `${label} bounds are missing`);
  assert(child.left >= parent.left - tolerance, `${label} spills left: ${JSON.stringify({ child, parent })}`);
  assert(child.right <= parent.right + tolerance, `${label} spills right: ${JSON.stringify({ child, parent })}`);
}

function assertVisible(state, label) {
  assert(state?.display !== 'none' && state?.visibility !== 'hidden' && state?.opacity > 0.5, `${label} is not visible: ${JSON.stringify(state)}`);
}

function assertHidden(state, label, details) {
  const hidden = state && (state.display === 'none' || state.visibility === 'hidden' || state.opacity <= 0.05);
  assert(hidden, `${label} must hide during form input: ${JSON.stringify({ state, details })}`);
  assert(state.pointerEvents === 'none' || state.display === 'none', `${label} must not receive pointer events while hidden`);
}

function assertBaseline(data, viewport) {
  assert(!data.appError, `${viewport.name} rendered an app/public-page error`);
  assert(!data.fallback, `${viewport.name} rendered a block fallback`);
  assert(data.bodyScrollWidth <= viewport.width + 3, `${viewport.name} body overflow: ${data.bodyScrollWidth} > ${viewport.width}`);
  assert(data.documentScrollWidth <= viewport.width + 3, `${viewport.name} document overflow: ${data.documentScrollWidth} > ${viewport.width}`);
  assert(data.viewport?.width <= 414.5, `${viewport.name} public viewport exceeded 414px: ${data.viewport?.width}`);
  assert(data.viewport?.width <= viewport.width + 1, `${viewport.name} public viewport exceeded browser width`);
  assertInside(data.landing, data.viewport, `${viewport.name} landing`);
  assertInside(data.topnav, data.landing, `${viewport.name} top navigation`);
  assertInside(data.timer, data.landing, `${viewport.name} timer`);
  assertInside(data.bottom, data.viewport, `${viewport.name} bottom bar`);
  assertInside(data.menuSet, data.topnav, `${viewport.name} menu set`, 6);
  assert(data.menuButtons?.length === 7, `${viewport.name} expected 7 menu buttons, got ${data.menuButtons?.length || 0}`);
  for (const [index, button] of data.menuButtons.entries()) {
    assertInside(button, data.menuSet, `${viewport.name} menu button ${index + 1}`, 4);
    assert(button.height >= 43, `${viewport.name} menu button ${index + 1} touch height is below 44px: ${button.height}`);
  }
  assert(JSON.stringify(data.menuRows) === JSON.stringify([4, 3]), `${viewport.name} menu rows must be 4+3, got ${JSON.stringify(data.menuRows)}`);
  assert(data.menuWidthSpreads.every((spread) => spread <= 3), `${viewport.name} menu widths are uneven: ${JSON.stringify(data.menuWidthSpreads)}`);
  assertVisible(data.topnavState, `${viewport.name} top navigation`);
  assertVisible(data.shareState, `${viewport.name} share button`);
  assertVisible(data.bottomState, `${viewport.name} bottom bar`);
  assert(data.share?.bottom <= data.bottom?.top - 4, `${viewport.name} share button overlaps bottom bar`);
  assert(data.inputExists, `${viewport.name} form input is missing`);
}

async function clickFormInput(client) {
  const selector = '.public-landing-viewport .landing-section.form input[type="text"], .public-landing-viewport .landing-section.form input:not([type])';
  const prepared = await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) return null;
    input.scrollIntoView({ block: 'center', inline: 'center' });
    return true;
  })()`);
  assert(prepared, 'Could not locate the form input for pointer focus');
  await wait(250);

  const point = await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) return null;
    const rect = input.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height };
  })()`);
  assert(point && point.width > 0 && point.height > 0, `Form input has invalid click bounds: ${JSON.stringify(point)}`);

  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
  await wait(400);

  const focus = await evaluate(client, `(() => {
    const active = document.activeElement;
    return {
      tag: active?.tagName || '',
      type: active?.getAttribute?.('type') || '',
      withinForm: !!active?.closest?.('.landing-section.form'),
      focusWithin: !!document.querySelector('.landing-section.form:focus-within'),
    };
  })()`);
  assert(focus?.withinForm && focus?.focusWithin, `Real pointer click did not focus the form input: ${JSON.stringify({ point, focus })}`);
  return focus;
}

async function capture(client, file) {
  const image = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(file, Buffer.from(image.data, 'base64'));
  const info = await stat(file);
  assert(info.size > 2000, `Screenshot is too small: ${file}`);
}

async function openPage(port, viewport, errors) {
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  const client = createCdp(target.webSocketDebuggerUrl);
  client.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') errors.push((params.args || []).map((arg) => arg.value || arg.description || '').join(' '));
  });
  client.on('Runtime.exceptionThrown', (params) => errors.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'page exception'));
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: initScript() });
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
  return { target, client };
}

async function closePage(port, target, client) {
  await client.close().catch(() => {});
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
}

const executable = resolveChrome();
assert(executable, 'Chrome/Chromium executable not found. Set INLET_BROWSER_QA_CHROME_PATH.');
await rm(screenshotDir, { recursive: true, force: true }).catch(() => {});
await mkdir(screenshotDir, { recursive: true });
const profileDir = await mkdtemp(path.join(tmpdir(), 'inlet-landing-browser-'));
const chromeErrors = [];
const browser = spawn(executable, [
  '--headless=new',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--remote-debugging-address=127.0.0.1',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
browser.stderr?.on('data', (chunk) => {
  const text = String(chunk).trim();
  if (text) chromeErrors.push(text);
});

const results = [];
try {
  await waitForChrome(debugPort).catch((error) => {
    throw new Error(`${error.message}; chrome stderr: ${chromeErrors.slice(-8).join(' | ')}`);
  });

  for (const viewport of viewports) {
    const errors = [];
    const { target, client } = await openPage(debugPort, viewport, errors);
    try {
      const baseline = await collectMetrics(client);
      assert(!errors.length, `${viewport.name} console/runtime errors: ${errors.join(' | ')}`);
      assertBaseline(baseline, viewport);
      const baselineFile = path.join(screenshotDir, `${viewport.name}-baseline.png`);
      await capture(client, baselineFile);
      results.push({ scenario: 'baseline', viewport: viewport.name, file: baselineFile, data: baseline });

      if (viewport.name === 'mobile-390') {
        const focus = await clickFormInput(client);
        const focused = await collectMetrics(client);
        assert(focused.activeWithinForm && focused.formFocusWithin, `Focused form state was lost before measurement: ${JSON.stringify({ focus, focused })}`);
        assertHidden(focused.topnavState, 'focused top navigation', focused);
        assertHidden(focused.shareState, 'focused share button', focused);
        assertHidden(focused.bottomState, 'focused bottom bar', focused);
        const focusFile = path.join(screenshotDir, `${viewport.name}-form-focus.png`);
        await capture(client, focusFile);
        results.push({ scenario: 'form-focus', viewport: viewport.name, file: focusFile, data: focused });
      }
    } finally {
      await closePage(debugPort, target, client);
    }
  }
} finally {
  browser.kill('SIGTERM');
  await wait(500);
  if (!browser.killed) browser.kill('SIGKILL');
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}

assert(results.length === viewports.length + 1, `Expected ${viewports.length + 1} visual results, got ${results.length}`);
console.log(JSON.stringify({
  ok: true,
  engine: 'chrome-cdp',
  executable,
  targetUrl,
  screenshotDir,
  results: results.map(({ scenario, viewport, file, data }) => ({
    scenario,
    viewport,
    file,
    menuRows: data.menuRows,
    publicViewportWidth: data.viewport?.width,
    landingWidth: data.landing?.width,
    bottomWidth: data.bottom?.width,
    activeWithinForm: data.activeWithinForm,
  })),
}, null, 2));
