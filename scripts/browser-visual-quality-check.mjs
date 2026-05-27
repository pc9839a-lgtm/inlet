import { createRequire } from 'node:module';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const targetUrl = process.env.INLET_BROWSER_QA_URL || '';
const requireRealBrowser = process.env.INLET_BROWSER_QA_REQUIRE === '1';
const extraUrls = String(process.env.INLET_BROWSER_QA_EXTRA_URLS || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const templateRoutesInput = String(process.env.INLET_BROWSER_QA_TEMPLATE_ROUTES || '').trim();
const templateRoutes = (templateRoutesInput === 'auto' ? ['/'] : templateRoutesInput)
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const screenshotDir = process.env.INLET_BROWSER_QA_SCREENSHOT_DIR || '.tmp-browser-visual';
const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const realBrowserCommand = 'INLET_BROWSER_QA_URL=http://localhost:5173 INLET_BROWSER_QA_REQUIRE=1 npm run browser:visual:qa';
const realBrowserPowerShellCommand = "$env:INLET_BROWSER_QA_URL='http://localhost:5173'; $env:INLET_BROWSER_QA_REQUIRE='1'; npm run browser:visual:qa; Remove-Item Env:\\INLET_BROWSER_QA_URL,Env:\\INLET_BROWSER_QA_REQUIRE";
const launchPlan = {
  desktopMobile: true,
  checks: ['blank-page', 'console-errors', 'horizontal-overflow', 'error-boundary', 'screenshot-written'],
  optionalTemplateRoutes: 'Set INLET_BROWSER_QA_TEMPLATE_ROUTES=auto or a comma-separated route list.',
};

function resolveOptional(name) {
  try {
    return require.resolve(name);
  } catch {
    return '';
  }
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

const hasPlaywright = !!resolveOptional('playwright');
const hasPuppeteer = !!resolveOptional('puppeteer');
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
} else {
  assert(!requireRealBrowser, 'INLET_BROWSER_QA_REQUIRE=1 requires Playwright or Puppeteer to be installed');
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: 'No Playwright or Puppeteer dependency is installed',
    targetUrl,
    extraUrls,
    templateRoutes,
    screenshotDir,
    cleanupArtifact: screenshotDir.startsWith('.tmp-'),
    fallback: 'rendering:qa static viewport contracts remain active',
    launchPlan,
    realBrowserCommand,
    realBrowserPowerShellCommand,
  }, null, 2));
}
