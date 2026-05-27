import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AUTH_KEY, DASHBOARD_KEY, START_MODE_KEY, STORAGE_KEY } from '../src/config/storageKeys.js';

const require = createRequire(import.meta.url);
const targetUrl = process.env.INLET_BROWSER_QA_URL || '';
const requireRealBrowser = process.env.INLET_BROWSER_QA_REQUIRE === '1';
const extraUrlsInput = String(process.env.INLET_BROWSER_QA_EXTRA_URLS || '').trim();
const autoExtraRoutes = ['/about', '/contact', '/privacy', '/terms'];
const extraUrls = (extraUrlsInput === 'auto' ? autoExtraRoutes.join(',') : extraUrlsInput)
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const templateRoutesInput = String(process.env.INLET_BROWSER_QA_TEMPLATE_ROUTES || '').trim();
const templateRoutes = (templateRoutesInput === 'auto' ? ['/'] : templateRoutesInput)
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const statePreset = String(process.env.INLET_BROWSER_QA_STATE_PRESET || '').trim();
const clickTexts = String(process.env.INLET_BROWSER_QA_CLICK_TEXT || '')
  .split(',')
  .map((text) => text.trim())
  .filter(Boolean);
const clickSelectors = String(process.env.INLET_BROWSER_QA_CLICK_SELECTOR || '')
  .split(',')
  .map((selector) => selector.trim())
  .filter(Boolean);
const expectedTexts = String(process.env.INLET_BROWSER_QA_EXPECT_TEXT || '')
  .split(',')
  .map((text) => text.trim())
  .filter(Boolean);
const forbiddenTexts = String(process.env.INLET_BROWSER_QA_FORBID_TEXT || '')
  .split(',')
  .map((text) => text.trim())
  .filter(Boolean);
const screenshotDir = process.env.INLET_BROWSER_QA_SCREENSHOT_DIR || '.tmp-browser-visual';
const chromeDebugPort = Number(process.env.INLET_BROWSER_QA_CHROME_PORT || 9223);
const chromePathInput = String(process.env.INLET_BROWSER_QA_CHROME_PATH || '').trim();
const viewportsInput = String(process.env.INLET_BROWSER_QA_VIEWPORTS || 'all').trim().toLowerCase();
const allViewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const viewports = viewportsInput === 'desktop'
  ? allViewports.filter((viewport) => viewport.name === 'desktop')
  : viewportsInput === 'mobile'
    ? allViewports.filter((viewport) => viewport.name === 'mobile')
    : allViewports;
const realBrowserCommand = 'INLET_BROWSER_QA_URL=http://localhost:5173 INLET_BROWSER_QA_REQUIRE=1 npm run browser:visual:qa';
const realBrowserPowerShellCommand = "$env:INLET_BROWSER_QA_URL='http://localhost:5173'; $env:INLET_BROWSER_QA_REQUIRE='1'; npm run browser:visual:qa; Remove-Item Env:\\INLET_BROWSER_QA_URL,Env:\\INLET_BROWSER_QA_REQUIRE";
const launchPlan = {
  desktopMobile: true,
  checks: ['blank-page', 'console-errors', 'horizontal-overflow', 'error-boundary', 'screenshot-written'],
  engines: ['playwright', 'puppeteer', 'local-chrome-cdp'],
  optionalExtraRoutes: 'Set INLET_BROWSER_QA_EXTRA_URLS=auto to cover footer/legal routes, or pass a comma-separated route list.',
  optionalTemplateRoutes: 'Set INLET_BROWSER_QA_TEMPLATE_ROUTES=auto or a comma-separated route list.',
  optionalStatePreset: 'Set INLET_BROWSER_QA_STATE_PRESET=owner-settings, client-settings, or manager-limited for authenticated visual states.',
  optionalInteraction: 'Set INLET_BROWSER_QA_CLICK_SELECTOR=.top-tabs button:last-child or INLET_BROWSER_QA_CLICK_TEXT=설정 and INLET_BROWSER_QA_EXPECT_TEXT=매니저 권한,소유권이전 for panel checks.',
  optionalViewports: 'Set INLET_BROWSER_QA_VIEWPORTS=desktop for authenticated admin/builder checks that are blocked on mobile.',
};

function resolveOptional(name) {
  try {
    return require.resolve(name);
  } catch {
    return '';
  }
}

function resolveChromePath() {
  const candidates = [
    chromePathInput,
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env.LocalAppData && path.join(process.env.LocalAppData, 'Google/Chrome/Application/chrome.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft/Edge/Application/msedge.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
    process.env.LocalAppData && path.join(process.env.LocalAppData, 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(Boolean);
  return candidates.find((file) => existsSync(file)) || '';
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertScreenshotCreated(file, label) {
  const info = await stat(file);
  assert(info.size > 1000, `${label} screenshot was not written or is too small: ${file}`);
}

function screenshotName(url, viewportName, index) {
  const safeUrl = url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72) || `target-${index + 1}`;
  return `${index + 1}-${safeUrl}-${viewportName}.png`;
}

function resolveTargetUrl(baseUrl, route) {
  if (/^https?:\/\//i.test(route)) return route;
  return new URL(route, baseUrl).toString();
}

function authStatePresetData(name) {
  const activeManager = {
    id: 'qa-manager-active',
    name: '운영 매니저',
    email: 'manager@example.test',
    status: 'active',
    invitedAt: '2026-05-01T00:00:00.000Z',
    inviteStatus: 'pending',
    access: {
      edit: { read: true, write: true },
      style: { read: false, write: false },
      inbox: { read: true, write: true },
      stats: { read: true, write: false },
      settings: { read: false, write: false },
    },
  };
  const basePage = {
    title: '브라우저 QA 페이지',
    slug: 'browser-qa',
    ownership: {
      ownerEmail: 'owner@example.test',
      clientEmail: 'client@example.test',
      clientAccess: true,
      managers: [
        activeManager,
        {
          ...activeManager,
          id: 'qa-manager-disabled',
          name: '비활성 매니저',
          email: 'disabled-manager@example.test',
          status: 'disabled',
        },
        {
          ...activeManager,
          id: 'qa-manager-removed',
          name: '삭제된 매니저',
          email: 'removed-manager@example.test',
          status: 'removed',
        },
      ],
      transferRequest: {
        status: 'requested',
        managerId: activeManager.id,
        managerName: activeManager.name,
        managerEmail: activeManager.email,
        requestedBy: 'owner@example.test',
        requestedAt: '2026-05-27T00:00:00.000Z',
        billingClearanceStatus: 'not-required',
        adminApprovalRequired: true,
      },
    },
  };
  if (name === 'owner-settings') {
    return {
      auth: { role: 'master', accessMode: 'builder', name: '마스터', email: 'owner@example.test', workspaceId: 'qa-owner', session: 'visual.qa.owner' },
      page: basePage,
      dashboard: { open: true },
      startMode: 'manual',
    };
  }
  if (name === 'client-settings') {
    return {
      auth: { role: 'client-admin', accessMode: 'clientAdmin', name: '클라이언트 관리자', email: 'client@example.test', workspaceId: 'qa-client', session: 'visual.qa.client' },
      page: basePage,
      dashboard: { open: true },
      startMode: 'manual',
    };
  }
  if (name === 'manager-limited') {
    return {
      auth: { role: 'manager', accessMode: 'manager', name: activeManager.name, email: activeManager.email, workspaceId: 'qa-manager', session: 'visual.qa.manager' },
      page: basePage,
      dashboard: { open: true },
      startMode: 'manual',
    };
  }
  if (!name) return null;
  throw new Error(`Unknown INLET_BROWSER_QA_STATE_PRESET: ${name}`);
}

function statePresetInitScript(name) {
  const data = authStatePresetData(name);
  if (!data) return '';
  return `(() => {
    const data = ${JSON.stringify(data)};
    localStorage.setItem(${JSON.stringify(AUTH_KEY)}, JSON.stringify(data.auth));
    localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(data.page));
    localStorage.setItem(${JSON.stringify(DASHBOARD_KEY)}, JSON.stringify(data.dashboard));
    localStorage.setItem(${JSON.stringify(START_MODE_KEY)}, data.startMode);
  })();`;
}

async function clickTextInPlaywrightLikePage(page, text) {
  const clicked = await page.evaluate((needle) => {
    const controls = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    const target = controls.find((control) => control.closest('.top-tabs') && (control.innerText || control.textContent || '').trim().includes(needle))
      || controls.find((control) => (control.innerText || control.textContent || '').trim().includes(needle));
    if (!target) return false;
    target.click();
    return true;
  }, text);
  assert(clicked, `could not find clickable text: ${text}`);
}

async function clickSelectorInPlaywrightLikePage(page, selector) {
  let clicked = false;
  const started = Date.now();
  while (!clicked && Date.now() - started < 6000) {
    clicked = await page.evaluate((targetSelector) => {
      const target = document.querySelector(targetSelector);
      if (!target) return false;
      target.click();
      return true;
    }, selector);
    if (!clicked) {
      if (typeof page.waitForTimeout === 'function') await page.waitForTimeout(250);
      else await wait(250);
    }
  }
  assert(clicked, `could not find clickable selector: ${selector}`);
}

async function runPlaywrightLikeActions(page) {
  for (const selector of clickSelectors) {
    await clickSelectorInPlaywrightLikePage(page, selector);
    if (typeof page.waitForTimeout === 'function') await page.waitForTimeout(350);
    else await wait(350);
  }
  for (const text of clickTexts) {
    await clickTextInPlaywrightLikePage(page, text);
    if (typeof page.waitForTimeout === 'function') await page.waitForTimeout(350);
    else await wait(350);
  }
}

async function waitForExpectedTextsInPlaywrightLikePage(page) {
  if (!expectedTexts.length) return;
  const started = Date.now();
  let lastSample = '';
  while (Date.now() - started < 6000) {
    const result = await page.evaluate((texts) => {
      const bodyText = document.body?.innerText || '';
      return {
        ok: texts.every((text) => bodyText.includes(text)),
        sample: bodyText.trim().slice(0, 600),
      };
    }, expectedTexts);
    if (result.ok) return;
    lastSample = result.sample || '';
    if (typeof page.waitForTimeout === 'function') await page.waitForTimeout(250);
    else await wait(250);
  }
  throw new Error(`expected text did not appear after interaction: ${expectedTexts.join(', ')}; body: ${lastSample}`);
}

async function clickTextInCdp(client, text) {
  const expression = `(() => {
    const needle = ${JSON.stringify(text)};
    const controls = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    const target = controls.find((control) => control.closest('.top-tabs') && (control.innerText || control.textContent || '').trim().includes(needle))
      || controls.find((control) => (control.innerText || control.textContent || '').trim().includes(needle));
    if (!target) return {
      clicked: false,
      labels: controls.map((control) => (control.innerText || control.textContent || '').trim()).filter(Boolean).slice(0, 24),
      bodyText: (document.body?.innerText || '').trim().slice(0, 500),
    };
    target.click();
    return { clicked: true };
  })()`;
  const result = await client.send('Runtime.evaluate', { expression, returnByValue: true });
  const value = result.result?.value || {};
  assert(value.clicked === true, `could not find clickable text: ${text}; visible controls: ${(value.labels || []).join(' | ')}; body: ${value.bodyText || ''}`);
}

async function clickSelectorInCdp(client, selector) {
  const expression = `(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) return false;
    target.click();
    return true;
  })()`;
  const started = Date.now();
  let clicked = false;
  while (!clicked && Date.now() - started < 6000) {
    const result = await client.send('Runtime.evaluate', { expression, returnByValue: true });
    clicked = result.result?.value === true;
    if (!clicked) await wait(250);
  }
  assert(clicked, `could not find clickable selector: ${selector}`);
}

async function runCdpActions(client) {
  for (const selector of clickSelectors) {
    await clickSelectorInCdp(client, selector);
    await wait(350);
  }
  for (const text of clickTexts) {
    await clickTextInCdp(client, text);
    await wait(350);
  }
}

async function waitForExpectedTextsInCdp(client) {
  if (!expectedTexts.length) return;
  const expression = `(() => {
    const texts = ${JSON.stringify(expectedTexts)};
    const bodyText = document.body?.innerText || '';
    return {
      ok: texts.every((text) => bodyText.includes(text)),
      sample: bodyText.trim().slice(0, 600),
    };
  })()`;
  const started = Date.now();
  let lastSample = '';
  while (Date.now() - started < 6000) {
    const result = await client.send('Runtime.evaluate', { expression, returnByValue: true });
    const value = result.result?.value || {};
    if (value.ok) return;
    lastSample = value.sample || '';
    await wait(250);
  }
  throw new Error(`expected text did not appear after interaction: ${expectedTexts.join(', ')}; body: ${lastSample}`);
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  assert(response.ok, `browser control request failed ${response.status}: ${url}`);
  return response.json();
}

async function waitForBrowserEndpoint(port) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  const started = Date.now();
  let lastError = '';
  while (Date.now() - started < 10000) {
    try {
      return await fetchJson(endpoint);
    } catch (error) {
      lastError = error.message;
      await wait(250);
    }
  }
  throw new Error(`local Chrome CDP endpoint did not start on ${endpoint}: ${lastError}`);
}

function createCdpClient(webSocketDebuggerUrl) {
  assert(typeof WebSocket === 'function', 'local Chrome CDP mode requires Node with global WebSocket support');
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  const socket = new WebSocket(webSocketDebuggerUrl);

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(payload.error.message || JSON.stringify(payload.error)));
      else resolve(payload.result || {});
      return;
    }
    const callbacks = listeners.get(payload.method) || [];
    for (const callback of callbacks) callback(payload.params || {});
  });

  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('failed to connect to Chrome CDP websocket')), { once: true });
  });

  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId++;
      const message = JSON.stringify({ id, method, params });
      const response = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(message);
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

async function evaluateBrowserMetrics(client) {
  const expression = String.raw`(() => {
    const body = document.body;
    const phone = document.querySelector('.phone-frame');
    const landing = document.querySelector('.landing-page');
    const errorScreen = document.querySelector('.error-screen, .app-error-screen, .block-render-fallback');
    const bodyText = body?.innerText || '';
    const phoneRect = phone?.getBoundingClientRect();
    const landingRect = landing?.getBoundingClientRect();
    const landingStyle = landing ? getComputedStyle(landing) : null;
      const expectedTexts = __EXPECTED_TEXTS__;
      const forbiddenTexts = __FORBIDDEN_TEXTS__;
    return {
      title: document.title,
      bodyTextLength: bodyText.trim().length || 0,
      bodyTextSample: bodyText.trim().slice(0, 600),
      expectedTextMatches: expectedTexts.reduce((matches, text) => {
        matches[text] = bodyText.includes(text);
        return matches;
      }, {}),
      forbiddenTextMatches: forbiddenTexts.reduce((matches, text) => {
        matches[text] = bodyText.includes(text);
        return matches;
      }, {}),
      bodyScrollWidth: body?.scrollWidth || 0,
      viewportWidth: window.innerWidth,
      phoneWidth: phoneRect?.width || 0,
      phoneHeight: phoneRect?.height || 0,
      landingWidth: landingRect?.width || 0,
      landingHeight: landingRect?.height || 0,
      landingOverflowY: landingStyle?.overflowY || '',
      errorScreen: !!errorScreen,
      appErrorText: bodyText.includes('화면을 불러오는 중 오류가 발생했습니다'),
      visibleControls: document.querySelectorAll('button, input, textarea, select, a').length,
    };
  })()`
    .replace('__EXPECTED_TEXTS__', JSON.stringify(expectedTexts))
    .replace('__FORBIDDEN_TEXTS__', JSON.stringify(forbiddenTexts));
  const result = await client.send('Runtime.evaluate', { expression, returnByValue: true });
  return result.result?.value || {};
}

function assertBrowserMetrics({ metrics, errors, viewport, url, screenshot }) {
  assert(!errors.length, `${viewport.name} console errors at ${url}; screenshot target ${screenshot}: ${errors.join(' | ')}`);
  assert(metrics.bodyTextLength > 0, `${viewport.name} rendered empty body at ${url}; screenshot target ${screenshot}`);
  assert(metrics.visibleControls > 0, `${viewport.name} rendered without visible controls/links at ${url}; screenshot target ${screenshot}`);
  assert(metrics.bodyScrollWidth <= viewport.width + 4, `${viewport.name} body has horizontal overflow at ${url}; screenshot target ${screenshot}`);
  assert(!metrics.errorScreen, `${viewport.name} error/fallback screen is visible at ${url}; screenshot target ${screenshot}`);
  assert(!metrics.appErrorText, `${viewport.name} app error boundary text is visible at ${url}; screenshot target ${screenshot}`);
  for (const text of expectedTexts) {
    assert(metrics.expectedTextMatches?.[text], `${viewport.name} expected text not found at ${url}: ${text}; screenshot target ${screenshot}; body: ${metrics.bodyTextSample || ''}`);
  }
  for (const text of forbiddenTexts) {
    assert(!metrics.forbiddenTextMatches?.[text], `${viewport.name} forbidden text appeared at ${url}: ${text}; screenshot target ${screenshot}; body: ${metrics.bodyTextSample || ''}`);
  }
  if (metrics.phoneWidth) {
    assert(metrics.phoneWidth <= 460, `${viewport.name} phone frame is too wide at ${url}; screenshot target ${screenshot}`);
    assert(metrics.phoneHeight <= 860, `${viewport.name} phone frame is too tall at ${url}; screenshot target ${screenshot}`);
  }
  if (metrics.landingWidth) {
    assert(['auto', 'scroll', 'overlay'].includes(metrics.landingOverflowY), `${viewport.name} landing page should scroll internally at ${url}; screenshot target ${screenshot}`);
  }
}

const hasPlaywright = !!resolveOptional('playwright');
const hasPuppeteer = !!resolveOptional('puppeteer');
const chromeExecutable = resolveChromePath();
const targets = targetUrl
  ? [targetUrl, ...extraUrls.map((url) => resolveTargetUrl(targetUrl, url)), ...templateRoutes.map((route) => resolveTargetUrl(targetUrl, route))]
  : [];

if (!targetUrl) {
  assert(!requireRealBrowser, 'INLET_BROWSER_QA_REQUIRE=1 requires INLET_BROWSER_QA_URL');
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: 'INLET_BROWSER_QA_URL is not set',
    fallback: 'rendering:qa static viewport contracts remain active',
    screenshotDir,
    extraUrls,
    templateRoutes,
    statePreset,
    clickSelectors,
    clickTexts,
    expectedTexts,
    forbiddenTexts,
    viewports: viewports.map((viewport) => viewport.name),
    cleanupArtifact: screenshotDir.startsWith('.tmp-'),
    launchPlan,
    realBrowserCommand,
    realBrowserPowerShellCommand,
  }, null, 2));
} else if (hasPlaywright) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const presetScript = statePresetInitScript(statePreset);
  await mkdir(screenshotDir, { recursive: true });

  try {
    for (const url of targets) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        const errors = [];
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        page.on('pageerror', (error) => errors.push(error.message));
        if (presetScript) await page.addInitScript(presetScript);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await runPlaywrightLikeActions(page);
        await waitForExpectedTextsInPlaywrightLikePage(page);
        const metrics = await page.evaluate((expectedTexts, forbiddenTexts) => {
        const body = document.body;
        const phone = document.querySelector('.phone-frame');
        const landing = document.querySelector('.landing-page');
        const errorScreen = document.querySelector('.error-screen, .app-error-screen, .block-render-fallback');
        const bodyText = body?.innerText || '';
        const phoneRect = phone?.getBoundingClientRect();
        const landingRect = landing?.getBoundingClientRect();
        const landingStyle = landing ? getComputedStyle(landing) : null;
        return {
          title: document.title,
          bodyTextLength: bodyText.trim().length || 0,
          bodyTextSample: bodyText.trim().slice(0, 600),
          expectedTextMatches: expectedTexts.reduce((matches, text) => {
            matches[text] = bodyText.includes(text);
            return matches;
          }, {}),
          forbiddenTextMatches: forbiddenTexts.reduce((matches, text) => {
            matches[text] = bodyText.includes(text);
            return matches;
          }, {}),
          bodyScrollWidth: body?.scrollWidth || 0,
          viewportWidth: window.innerWidth,
          phoneWidth: phoneRect?.width || 0,
          phoneHeight: phoneRect?.height || 0,
          landingWidth: landingRect?.width || 0,
          landingHeight: landingRect?.height || 0,
          landingOverflowY: landingStyle?.overflowY || '',
          errorScreen: !!errorScreen,
          appErrorText: bodyText.includes('화면을 불러오는 중 오류가 발생했습니다.'),
          visibleControls: document.querySelectorAll('button, input, textarea, select, a').length,
        };
        }, expectedTexts, forbiddenTexts);

        const screenshot = path.join(screenshotDir, screenshotName(url, viewport.name, results.length));
        assertBrowserMetrics({ metrics, errors, viewport, url, screenshot });
        await page.screenshot({ path: screenshot, fullPage: true });
        await assertScreenshotCreated(screenshot, viewport.name);
        results.push({ url, viewport: viewport.name, screenshot, metrics });
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  assert(results.length === targets.length * viewports.length, `expected ${targets.length * viewports.length} screenshots, got ${results.length}`);
  console.log(JSON.stringify({ ok: true, engine: 'playwright', targetUrl, extraUrls, templateRoutes, statePreset, clickSelectors, clickTexts, expectedTexts, forbiddenTexts, screenshotDir, cleanupArtifact: screenshotDir.startsWith('.tmp-'), results }, null, 2));
} else if (hasPuppeteer) {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ headless: 'new' });
  const results = [];
  const presetScript = statePresetInitScript(statePreset);
  await mkdir(screenshotDir, { recursive: true });

  try {
    for (const url of targets) {
      for (const viewport of viewports) {
        const page = await browser.newPage();
        const errors = [];
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        page.on('pageerror', (error) => errors.push(error.message));
        await page.setViewport({ width: viewport.width, height: viewport.height });
        if (presetScript) await page.evaluateOnNewDocument(presetScript);
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        await runPlaywrightLikeActions(page);
        await waitForExpectedTextsInPlaywrightLikePage(page);
        const metrics = await page.evaluate((expectedTexts, forbiddenTexts) => {
        const body = document.body;
        const phone = document.querySelector('.phone-frame');
        const landing = document.querySelector('.landing-page');
        const errorScreen = document.querySelector('.error-screen, .app-error-screen, .block-render-fallback');
        const bodyText = body?.innerText || '';
        const phoneRect = phone?.getBoundingClientRect();
        const landingStyle = landing ? getComputedStyle(landing) : null;
        return {
          bodyTextLength: bodyText.trim().length || 0,
          bodyTextSample: bodyText.trim().slice(0, 600),
          expectedTextMatches: expectedTexts.reduce((matches, text) => {
            matches[text] = bodyText.includes(text);
            return matches;
          }, {}),
          forbiddenTextMatches: forbiddenTexts.reduce((matches, text) => {
            matches[text] = bodyText.includes(text);
            return matches;
          }, {}),
          bodyScrollWidth: body?.scrollWidth || 0,
          viewportWidth: window.innerWidth,
          phoneWidth: phoneRect?.width || 0,
          phoneHeight: phoneRect?.height || 0,
          landingOverflowY: landingStyle?.overflowY || '',
          errorScreen: !!errorScreen,
          appErrorText: bodyText.includes('화면을 불러오는 중 오류가 발생했습니다.'),
          visibleControls: document.querySelectorAll('button, input, textarea, select, a').length,
        };
        }, expectedTexts, forbiddenTexts);

        const screenshot = path.join(screenshotDir, screenshotName(url, viewport.name, results.length));
        assertBrowserMetrics({ metrics, errors, viewport, url, screenshot });
        await page.screenshot({ path: screenshot, fullPage: true });
        await assertScreenshotCreated(screenshot, viewport.name);
        results.push({ url, viewport: viewport.name, screenshot, metrics });
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  assert(results.length === targets.length * viewports.length, `expected ${targets.length * viewports.length} screenshots, got ${results.length}`);
  console.log(JSON.stringify({ ok: true, engine: 'puppeteer', targetUrl, extraUrls, templateRoutes, statePreset, clickSelectors, clickTexts, expectedTexts, forbiddenTexts, screenshotDir, cleanupArtifact: screenshotDir.startsWith('.tmp-'), results }, null, 2));
} else if (chromeExecutable) {
  const browserUserDataDir = path.resolve(screenshotDir, '.chrome-profile');
  await rm(browserUserDataDir, { recursive: true, force: true });
  await mkdir(browserUserDataDir, { recursive: true });
  const chromeErrors = [];
  const browser = spawn(chromeExecutable, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
    `--remote-debugging-port=${chromeDebugPort}`,
    `--user-data-dir=${browserUserDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  browser.stderr?.on('data', (chunk) => {
    const line = String(chunk).trim();
    if (line) chromeErrors.push(line);
  });
  const results = [];
  const presetScript = statePresetInitScript(statePreset);

  try {
    await waitForBrowserEndpoint(chromeDebugPort).catch((error) => {
      const detail = chromeErrors.slice(-5).join(' | ');
      throw new Error(detail ? `${error.message}; chrome stderr: ${detail}` : error.message);
    });
    for (const url of targets) {
      for (const viewport of viewports) {
        const target = await fetchJson(`http://127.0.0.1:${chromeDebugPort}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
        const client = createCdpClient(target.webSocketDebuggerUrl);
        const errors = [];
        client.on('Runtime.consoleAPICalled', (params) => {
          if (params.type === 'error') {
            errors.push((params.args || []).map((arg) => arg.value || arg.description || '').join(' '));
          }
        });
        client.on('Runtime.exceptionThrown', (params) => errors.push(params.exceptionDetails?.text || 'page exception'));
        await client.send('Runtime.enable');
        await client.send('Page.enable');
        if (presetScript) await client.send('Page.addScriptToEvaluateOnNewDocument', { source: presetScript });
        await client.send('Emulation.setDeviceMetricsOverride', {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: viewport.name === 'mobile',
        });
        await client.send('Page.navigate', { url });
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 12000);
          client.on('Page.loadEventFired', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        await wait(800);
        await runCdpActions(client);
        await waitForExpectedTextsInCdp(client);
        const metrics = await evaluateBrowserMetrics(client);
        const screenshot = path.join(screenshotDir, screenshotName(url, viewport.name, results.length));
        assertBrowserMetrics({ metrics, errors, viewport, url, screenshot });
        const captured = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        await writeFile(screenshot, Buffer.from(captured.data, 'base64'));
        await assertScreenshotCreated(screenshot, viewport.name);
        results.push({ url, viewport: viewport.name, screenshot, metrics });
        await client.close();
        await fetch(`http://127.0.0.1:${chromeDebugPort}/json/close/${target.id}`).catch(() => {});
      }
    }
  } finally {
    browser.kill();
  }

  assert(results.length === targets.length * viewports.length, `expected ${targets.length * viewports.length} screenshots, got ${results.length}`);
  console.log(JSON.stringify({ ok: true, engine: 'local-chrome-cdp', chromeExecutable, targetUrl, extraUrls, templateRoutes, statePreset, clickSelectors, clickTexts, expectedTexts, forbiddenTexts, screenshotDir, cleanupArtifact: screenshotDir.startsWith('.tmp-'), results }, null, 2));
} else {
  assert(!requireRealBrowser, 'INLET_BROWSER_QA_REQUIRE=1 requires Playwright, Puppeteer, or local Chrome/Edge. Set INLET_BROWSER_QA_CHROME_PATH if Chrome is installed in a custom path.');
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: 'No Playwright/Puppeteer dependency or local Chrome/Edge executable was found',
    targetUrl,
    extraUrls,
    templateRoutes,
    statePreset,
    clickSelectors,
    clickTexts,
    expectedTexts,
    forbiddenTexts,
    viewports: viewports.map((viewport) => viewport.name),
    screenshotDir,
    cleanupArtifact: screenshotDir.startsWith('.tmp-'),
    fallback: 'rendering:qa static viewport contracts remain active',
    chromePathChecked: Boolean(chromePathInput),
    launchPlan,
    realBrowserCommand,
    realBrowserPowerShellCommand,
  }, null, 2));
}
