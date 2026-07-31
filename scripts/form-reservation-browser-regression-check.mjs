import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const origin = String(process.env.INLET_FORM_BROWSER_QA_ORIGIN || 'http://127.0.0.1:4175').replace(/\/$/, '');
const screenshotDir = process.env.INLET_FORM_BROWSER_QA_SCREENSHOT_DIR || '.tmp-form-browser-regression';
const debugPort = Number(process.env.INLET_FORM_BROWSER_QA_CHROME_PORT || 9351);
const chromeInput = String(process.env.INLET_FORM_BROWSER_QA_CHROME_PATH || '').trim();
const slug = 'form-reservation-e2e';

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
  ].filter(Boolean).find((candidate) => existsSync(candidate)) || '';
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

function qaUser() {
  return {
    id: 'form-e2e-user',
    accountId: 'form-e2e-owner',
    ownerId: 'form-e2e-owner',
    workspaceId: 'form-e2e-project',
    projectId: 'form-e2e-project',
    name: '폼 QA',
    email: 'form.qa@example.com',
    role: 'master',
    accessMode: 'master',
    plan: 'QA',
    status: 'active',
  };
}

function qaPage() {
  return {
    id: 'form-e2e-page',
    projectId: 'form-e2e-project',
    ownerId: 'form-e2e-owner',
    ownerEmail: 'form.qa@example.com',
    title: '폼 제출 E2E',
    slug,
    status: 'published',
    revision: 1,
    updatedAt: '2026-07-31T00:00:00.000Z',
    share: { enabled: false, position: 'top-right', display: 'icon' },
    theme: {
      accent: '#2563eb',
      bgMode: 'solid',
      bg: '#f3f4f6',
      bgSolid: '#f3f4f6',
      card: '#ffffff',
      text: '#111827',
      radius: 20,
      font: 'modern',
      fontFamily: 'pretendard',
      globalAlign: 'left',
      animOn: false,
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
        id: 'form-e2e-topnav',
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
          sticky: true,
          menus: [
            { id: 'form-menu', label: '상담', target: 'consult-form', url: '' },
            { id: 'reservation-menu', label: '예약', target: 'reserve-form', url: '' },
          ],
        },
      },
      {
        id: 'form-e2e-hero',
        type: 'hero',
        visible: true,
        s: {
          title: '상담과 예약을 실제로 제출합니다',
          body: '버튼 연타와 중복 연락처 차단까지 확인합니다.',
          image: '',
          imageMode: 'top',
          imageFit: 'contain',
          imageHeightPx: 220,
          align: 'left',
          titleSize: 'large',
          bodySize: 'medium',
          height: 'small',
        },
      },
      {
        id: 'consult-form',
        type: 'form',
        visible: true,
        s: {
          title: '상담 신청',
          desc: '상담 정보를 입력해주세요.',
          style: 'card',
          submit: '상담 신청하기',
          successTitle: '상담 신청 완료',
          success: '상담 신청이 정상 접수되었습니다.',
          privacy: '개인정보 수집 및 이용에 동의합니다.',
          privacyRequired: true,
          privacyDetail: '수집 항목: 이름, 연락처, 문의내용',
          inputStyle: 'round',
          buttonStyle: 'solid',
          buttonHover: 'fill',
          spacing: 'normal',
          radiusStyle: 'round',
          duplicatePhone: 'block',
          duplicateEmail: 'off',
          duplicateWindow: '1d',
          questions: [
            { id: 'consult-name', label: '이름', type: 'name', required: true, options: [] },
            { id: 'consult-phone', label: '연락처', type: 'phone', required: true, options: [] },
            { id: 'consult-message', label: '문의내용', type: 'long', required: true, options: [] },
          ],
        },
      },
      {
        id: 'reserve-form',
        type: 'reservation',
        visible: true,
        s: {
          title: '방문 예약',
          desc: '희망 날짜와 시간을 선택해주세요.',
          submit: '방문예약 신청하기',
          success: '방문예약 신청이 접수되었습니다.',
          weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
          start: '10:00',
          end: '11:00',
          interval: 30,
          fields: { name: true, phone: true },
          required: { name: true, phone: true },
          customFields: [],
          style: 'card',
          inputStyle: 'round',
          buttonStyle: 'solid',
          buttonHover: 'fill',
          spacing: 'normal',
          radiusStyle: 'round',
          duplicatePhone: 'block',
          duplicateWindow: '1d',
        },
      },
      {
        id: 'form-e2e-footer',
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

function parseBody(value = '') {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function createApiMock(client) {
  const page = qaPage();
  const user = qaUser();
  const state = {
    leads: [],
    leadPosts: 0,
    eventPosts: 0,
    leadGets: 0,
    sessionPosts: 0,
    pageGets: 0,
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
    const body = parseBody(request.postData || '');

    if (pathname === `/api/pages/${slug}` && method === 'GET') {
      state.pageGets += 1;
      await fulfill(requestId, 200, { page });
      return;
    }

    if (pathname === '/api/leads' && method === 'POST') {
      state.leadPosts += 1;
      await wait(400);
      const sourceLead = body.lead || {};
      const savedLead = {
        ...sourceLead,
        id: `form-e2e-lead-${state.leadPosts}`,
        projectId: page.projectId,
        ownerId: page.ownerId,
        pageId: page.id,
        pageSlug: page.slug,
        status: '신규',
        createdAt: new Date().toISOString(),
        deliveryStatus: 'success',
        delivery: { status: 'success', summary: '내부 저장 완료', logs: [] },
      };
      state.leads.unshift(savedLead);
      await fulfill(requestId, 200, { ok: true, lead: savedLead });
      return;
    }

    if (pathname === '/api/leads' && method === 'GET') {
      state.leadGets += 1;
      await fulfill(requestId, 200, {
        leads: state.leads,
        total: state.leads.length,
        nextCursor: null,
        hasMore: false,
      });
      return;
    }

    if (pathname === '/api/events' && method === 'POST') {
      state.eventPosts += 1;
      await fulfill(requestId, 200, { ok: true, event: body.event || null });
      return;
    }

    if (pathname === '/api/events' && method === 'GET') {
      await fulfill(requestId, 200, { events: [], total: 0, nextCursor: null, hasMore: false });
      return;
    }

    if (pathname === '/api/auth/session' && method === 'POST') {
      state.sessionPosts += 1;
      await fulfill(requestId, 200, { user, session: 'form-e2e-session' });
      return;
    }

    if (pathname === '/api/projects' && method === 'GET') {
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
          leadCount: state.leads.length,
        }],
      });
      return;
    }

    if (pathname === '/api/stats/summary' && method === 'GET') {
      await fulfill(requestId, 200, { summary: null, leads: state.leads, events: [] });
      return;
    }

    if (pathname === '/api/leads/blocked-history' && method === 'GET') {
      await fulfill(requestId, 200, { records: [], total: 0, nextCursor: null, hasMore: false });
      return;
    }

    state.unexpectedApis.push(`${method} ${pathname}`);
    await fulfill(requestId, 404, { error: 'unexpected form browser QA API request', method, pathname });
  };

  client.on('Fetch.requestPaused', (params) => {
    handler(params).catch((error) => {
      state.interceptError = error;
      client.send('Fetch.failRequest', { requestId: params.requestId, errorReason: 'Failed' }).catch(() => {});
    });
  });

  return { state, page, user };
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
    await wait(180);
  }
  throw new Error(`${label} did not become ready: ${JSON.stringify(last)}`);
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
  if (mobile) await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  else await client.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await wait(300);
}

async function setValue(client, selector, value) {
  const result = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    const prototypes = [HTMLInputElement.prototype, HTMLTextAreaElement.prototype, HTMLSelectElement.prototype];
    const prototype = prototypes.find((item) => element instanceof item.constructor);
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter?.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return element.value === ${JSON.stringify(value)};
  })()`);
  assert(result, `Unable to set ${selector}`);
}

async function setChecked(client, selector, checked = true) {
  const result = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
    setter?.call(element, ${checked ? 'true' : 'false'});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return element.checked === ${checked ? 'true' : 'false'};
  })()`);
  assert(result, `Unable to set checkbox ${selector}`);
}

async function click(client, selector) {
  const result = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.scrollIntoView({ block: 'center', inline: 'center' });
    element.click();
    return true;
  })()`);
  assert(result, `Unable to click ${selector}`);
}

async function capture(client, name) {
  const image = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(screenshotDir, `${name}.png`), Buffer.from(image.data, 'base64'));
}

async function submitRapidly(client, selector) {
  await click(client, selector);
  await wait(45);
  const locked = await evaluate(client, `(() => {
    const button = document.querySelector(${JSON.stringify(selector)});
    if (!button) return false;
    const locked = button.disabled && /접수 중/.test(button.textContent || '');
    button.click();
    return locked;
  })()`);
  assert(locked, `${selector} must lock while the request is in flight`);
}

async function run() {
  const chrome = resolveChrome();
  assert(chrome, 'Chrome or Chromium executable was not found');
  await mkdir(screenshotDir, { recursive: true });
  await writeFile(path.join(screenshotDir, 'run-started.txt'), `form browser regression started at ${new Date().toISOString()}\n`);
  const profileDir = await mkdtemp(path.join(tmpdir(), 'inlet-form-browser-'));
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
    const { state, page, user } = createApiMock(client);

    await setViewport(client, 390, 844, true);
    await client.send('Page.navigate', { url: `${origin}/${slug}` });
    await waitForBrowser(client, `!!document.querySelector('#block-consult-form form') && !!document.querySelector('#block-reserve-form form')`, 'public consultation and reservation forms');

    await setValue(client, '#block-consult-form input[placeholder="이름을 입력해주세요"]', '상담 고객');
    await setValue(client, '#block-consult-form input[type="tel"]', '01011112222');
    await setValue(client, '#block-consult-form textarea', '실제 상담 제출 테스트입니다.');
    await setChecked(client, '#block-consult-form .agree input[type="checkbox"]');
    await submitRapidly(client, '#block-consult-form button[type="submit"]');
    await waitForBrowser(client, `(document.querySelector('#block-consult-form')?.innerText || '').includes('상담 신청 완료')`, 'consultation success state');
    assert(state.leadPosts === 1, `rapid consultation clicks created ${state.leadPosts} lead requests`);
    assert(state.leads[0]?.type === '상담신청', `consultation lead type mismatch: ${state.leads[0]?.type}`);
    assert(state.leads[0]?.phone === '01011112222', `consultation phone mismatch: ${state.leads[0]?.phone}`);
    assert(state.leads[0]?.message === '실제 상담 제출 테스트입니다.', 'consultation message was not persisted');
    await capture(client, 'consultation-success');

    await click(client, '#block-consult-form .success button');
    await setValue(client, '#block-consult-form input[placeholder="이름을 입력해주세요"]', '상담 고객');
    await setValue(client, '#block-consult-form input[type="tel"]', '01011112222');
    await setValue(client, '#block-consult-form textarea', '중복 상담 제출입니다.');
    await setChecked(client, '#block-consult-form .agree input[type="checkbox"]');
    await click(client, '#block-consult-form button[type="submit"]');
    await waitForBrowser(client, `(document.querySelector('#block-consult-form')?.innerText || '').includes('이미 접수된 연락처')`, 'consultation duplicate block');
    assert(state.leadPosts === 1, 'blocked consultation duplicate must not reach the lead API');
    await capture(client, 'consultation-duplicate-blocked');

    const reservationDate = await evaluate(client, `(() => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return [yyyy, mm, dd].join('-');
    })()`);
    await setValue(client, '#block-reserve-form input[placeholder="이름을 입력해주세요"]', '예약 고객');
    await setValue(client, '#block-reserve-form input[type="tel"]', '01033334444');
    await setValue(client, '#block-reserve-form input[type="date"]', reservationDate);
    await setValue(client, '#block-reserve-form select', '10:00');
    await setChecked(client, '#block-reserve-form .agree input[type="checkbox"]');
    await submitRapidly(client, '#block-reserve-form button[type="submit"]');
    await waitForBrowser(client, `(document.querySelector('#block-reserve-form')?.innerText || '').includes('방문예약 신청이 접수되었습니다')`, 'reservation success state');
    assert(state.leadPosts === 2, `rapid reservation clicks created ${state.leadPosts - 1} reservation requests`);
    assert(state.leads[0]?.type === '방문예약', `reservation lead type mismatch: ${state.leads[0]?.type}`);
    assert(state.leads[0]?.phone === '01033334444', `reservation phone mismatch: ${state.leads[0]?.phone}`);
    assert(state.leads[0]?.values?.예약일 === reservationDate && state.leads[0]?.values?.예약시간 === '10:00', 'reservation date or time was not persisted');
    await capture(client, 'reservation-success');

    await click(client, '#block-reserve-form .success button');
    await setValue(client, '#block-reserve-form input[placeholder="이름을 입력해주세요"]', '예약 고객');
    await setValue(client, '#block-reserve-form input[type="tel"]', '01033334444');
    await setValue(client, '#block-reserve-form input[type="date"]', reservationDate);
    await setValue(client, '#block-reserve-form select', '10:30');
    await setChecked(client, '#block-reserve-form .agree input[type="checkbox"]');
    await click(client, '#block-reserve-form button[type="submit"]');
    await waitForBrowser(client, `(document.querySelector('#block-reserve-form')?.innerText || '').includes('이미 접수된 연락처')`, 'reservation duplicate block');
    assert(state.leadPosts === 2, 'blocked reservation duplicate must not reach the lead API');
    await capture(client, 'reservation-duplicate-blocked');

    await evaluate(client, `(() => {
      localStorage.setItem('mobile-db-landing-v12-safe-page', JSON.stringify(${JSON.stringify(page)}));
      localStorage.setItem('inlet-auth-v1', JSON.stringify(${JSON.stringify(user)}));
      localStorage.setItem('inlet-dashboard-v1', JSON.stringify({ open: true }));
      return true;
    })()`);
    await setViewport(client, 1280, 900, false);
    await client.send('Page.navigate', { url: `${origin}/app?tab=inbox` });
    await waitForBrowser(client, `!!document.querySelector('.inbox-panel') && (document.body?.innerText || '').includes('상담 고객') && (document.body?.innerText || '').includes('예약 고객')`, 'inbox lead reflection');
    const inboxMetrics = await evaluate(client, `(() => ({
      path: location.pathname,
      innerWidth,
      bodyScrollWidth: document.body?.scrollWidth || 0,
      documentScrollWidth: document.documentElement?.scrollWidth || 0,
      leadCards: document.querySelectorAll('.lead-card-service').length,
      text: document.body?.innerText || '',
    }))()`);
    assert(inboxMetrics.path === '/app', `inbox route changed: ${inboxMetrics.path}`);
    assert(inboxMetrics.bodyScrollWidth <= inboxMetrics.innerWidth + 3, 'inbox body has horizontal overflow');
    assert(inboxMetrics.documentScrollWidth <= inboxMetrics.innerWidth + 3, 'inbox document has horizontal overflow');
    assert(inboxMetrics.leadCards === 2, `inbox must render two submitted leads: ${inboxMetrics.leadCards}`);
    assert(inboxMetrics.text.includes('상담') && inboxMetrics.text.includes('예약'), 'inbox summary must classify consultation and reservation leads');
    assert(state.leadGets >= 1, 'inbox did not load submitted leads from the API');
    assert(state.sessionPosts >= 1, 'inbox session was not refreshed');
    await capture(client, 'inbox-reflection');

    assert(state.eventPosts >= 4, `expected form and reservation analytics events, received ${state.eventPosts}`);
    assert(!state.interceptError, `API interception failed: ${state.interceptError?.message || state.interceptError}`);
    assert(state.unexpectedApis.length === 0, `Unexpected API requests: ${state.unexpectedApis.join(', ')}`);
    assert(browserErrors.length === 0, `Browser exceptions: ${browserErrors.join('\n')}`);

    console.log(JSON.stringify({
      ok: true,
      scope: 'form-reservation-browser-regression',
      consultationRequests: 1,
      reservationRequests: 1,
      duplicateRequestsBlocked: 2,
      inboxLeadCards: inboxMetrics.leadCards,
      eventPosts: state.eventPosts,
      screenshots: 5,
    }, null, 2));
  } finally {
    await client?.close().catch(() => {});
    if (child && !child.killed) child.kill('SIGTERM');
    await rm(profileDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
}

await run();
