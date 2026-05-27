import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
const screenshotDir = process.env.INLET_BROWSER_QA_SCREENSHOT_DIR || '.tmp-browser-visual';
const chromeDebugPort = Number(process.env.INLET_BROWSER_QA_CHROME_PORT || 9223);
const chromePathInput = String(process.env.INLET_BROWSER_QA_CHROME_PATH || '').trim();
const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const realBrowserCommand = 'INLET_BROWSER_QA_URL=http://localhost:5173 INLET_BROWSER_QA_REQUIRE=1 npm run browser:visual:qa';
const realBrowserPowerShellCommand = "$env:INLET_BROWSER_QA_URL='http://localhost:5173'; $env:INLET_BROWSER_QA_REQUIRE='1'; npm run browser:visual:qa; Remove-Item Env:\\INLET_BROWSER_QA_URL,Env:\\INLET_BROWSER_QA_REQUIRE";
const launchPlan = {
  desktopMobile: true,
  checks: ['blank-page', 'console-errors', 'horizontal-overflow', 'error-boundary', 'screenshot-written'],
  engines: ['playwright', 'puppeteer', 'local-chrome-cdp'],
  optionalExtraRoutes: 'Set INLET_BROWSER_QA_EXTRA_URLS=auto to cover footer/legal routes, or pass a comma-separated route list.',
  optionalTemplateRoutes: 'Set INLET_BROWSER_QA_TEMPLATE_ROUTES=auto or a comma-separated route list.',
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
    return {
      title: document.title,
      bodyTextLength: bodyText.trim().length || 0,
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
  })()`;
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
    cleanupArtifact: screenshotDir.startsWith('.tmp-'),
    launchPlan,
    realBrowserCommand,
    realBrowserPowerShellCommand,
  }, null, 2));
} else if (hasPlaywright) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const results = [];
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
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        const metrics = await page.evaluate(() => {
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
        });

        const screenshot = path.join(screenshotDir, screenshotName(url, viewport.name, results.length));
        assert(!errors.length, `${viewport.name} console errors at ${url}; screenshot target ${screenshot}: ${errors.join(' | ')}`);
        assert(metrics.bodyTextLength > 0, `${viewport.name} rendered empty body at ${url}; screenshot target ${screenshot}`);
        assert(metrics.visibleControls > 0, `${viewport.name} rendered without visible controls/links at ${url}; screenshot target ${screenshot}`);
        assert(metrics.bodyScrollWidth <= viewport.width + 4, `${viewport.name} body has horizontal overflow at ${url}; screenshot target ${screenshot}`);
        assert(!metrics.errorScreen, `${viewport.name} error/fallback screen is visible at ${url}; screenshot target ${screenshot}`);
        assert(!metrics.appErrorText, `${viewport.name} app error boundary text is visible at ${url}; screenshot target ${screenshot}`);
        if (metrics.phoneWidth) {
          assert(metrics.phoneWidth <= 460, `${viewport.name} phone frame is too wide at ${url}; screenshot target ${screenshot}`);
          assert(metrics.phoneHeight <= 860, `${viewport.name} phone frame is too tall at ${url}; screenshot target ${screenshot}`);
        }
        if (metrics.landingWidth) {
          assert(['auto', 'scroll', 'overlay'].includes(metrics.landingOverflowY), `${viewport.name} landing page should scroll internally at ${url}; screenshot target ${screenshot}`);
        }
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
  console.log(JSON.stringify({ ok: true, engine: 'playwright', targetUrl, extraUrls, templateRoutes, screenshotDir, cleanupArtifact: screenshotDir.startsWith('.tmp-'), results }, null, 2));
} else if (hasPuppeteer) {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ headless: 'new' });
  const results = [];
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
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        const metrics = await page.evaluate(() => {
        const body = document.body;
        const phone = document.querySelector('.phone-frame');
        const landing = document.querySelector('.landing-page');
        const errorScreen = document.querySelector('.error-screen, .app-error-screen, .block-render-fallback');
        const bodyText = body?.innerText || '';
        const phoneRect = phone?.getBoundingClientRect();
        const landingStyle = landing ? getComputedStyle(landing) : null;
        return {
          bodyTextLength: bodyText.trim().length || 0,
          bodyScrollWidth: body?.scrollWidth || 0,
          viewportWidth: window.innerWidth,
          phoneWidth: phoneRect?.width || 0,
          phoneHeight: phoneRect?.height || 0,
          landingOverflowY: landingStyle?.overflowY || '',
          errorScreen: !!errorScreen,
          appErrorText: bodyText.includes('화면을 불러오는 중 오류가 발생했습니다.'),
          visibleControls: document.querySelectorAll('button, input, textarea, select, a').length,
        };
        });

        const screenshot = path.join(screenshotDir, screenshotName(url, viewport.name, results.length));
        assert(!errors.length, `${viewport.name} console errors at ${url}; screenshot target ${screenshot}: ${errors.join(' | ')}`);
        assert(metrics.bodyTextLength > 0, `${viewport.name} rendered empty body at ${url}; screenshot target ${screenshot}`);
        assert(metrics.visibleControls > 0, `${viewport.name} rendered without visible controls/links at ${url}; screenshot target ${screenshot}`);
        assert(metrics.bodyScrollWidth <= viewport.width + 4, `${viewport.name} body has horizontal overflow at ${url}; screenshot target ${screenshot}`);
        assert(!metrics.errorScreen, `${viewport.name} error/fallback screen is visible at ${url}; screenshot target ${screenshot}`);
        assert(!metrics.appErrorText, `${viewport.name} app error boundary text is visible at ${url}; screenshot target ${screenshot}`);
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
  console.log(JSON.stringify({ ok: true, engine: 'puppeteer', targetUrl, extraUrls, templateRoutes, screenshotDir, cleanupArtifact: screenshotDir.startsWith('.tmp-'), results }, null, 2));
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
    `--remote-debugging-port=${chromeDebugPort}`,
    `--user-data-dir=${browserUserDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  browser.stderr?.on('data', (chunk) => {
    const line = String(chunk).trim();
    if (line) chromeErrors.push(line);
  });
  const results = [];

  try {
    await waitForBrowserEndpoint(chromeDebugPort).catch((error) => {
      const detail = chromeErrors.slice(-5).join(' | ');
      throw new Error(detail ? `${error.message}; chrome stderr: ${detail}` : error.message);
    });
    for (const url of targets) {
      for (const viewport of viewports) {
        const target = await fetchJson(`http://127.0.0.1:${chromeDebugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
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
  console.log(JSON.stringify({ ok: true, engine: 'local-chrome-cdp', chromeExecutable, targetUrl, extraUrls, templateRoutes, screenshotDir, cleanupArtifact: screenshotDir.startsWith('.tmp-'), results }, null, 2));
} else {
  assert(!requireRealBrowser, 'INLET_BROWSER_QA_REQUIRE=1 requires Playwright, Puppeteer, or local Chrome/Edge. Set INLET_BROWSER_QA_CHROME_PATH if Chrome is installed in a custom path.');
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: 'No Playwright/Puppeteer dependency or local Chrome/Edge executable was found',
    targetUrl,
    extraUrls,
    templateRoutes,
    screenshotDir,
    cleanupArtifact: screenshotDir.startsWith('.tmp-'),
    fallback: 'rendering:qa static viewport contracts remain active',
    chromePathChecked: Boolean(chromePathInput),
    launchPlan,
    realBrowserCommand,
    realBrowserPowerShellCommand,
  }, null, 2));
}
