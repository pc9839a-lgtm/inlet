import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { STORAGE_KEY } from '../src/config/storageKeys.js';
import { createTemplatePage } from '../src/templates/landingTemplates.js';

const origin = String(process.env.INLET_TEMPLATE_MOBILE_QA_ORIGIN || 'http://127.0.0.1:4176').replace(/\/$/, '');
const screenshotDir = process.env.INLET_TEMPLATE_MOBILE_QA_SCREENSHOT_DIR || '.tmp-template-mobile-regression';
const debugPort = Number(process.env.INLET_TEMPLATE_MOBILE_QA_CHROME_PORT || 9341);
const chromeInput = String(process.env.INLET_TEMPLATE_MOBILE_QA_CHROME_PATH || '').trim();
const viewports = [
  { name: 'mobile-360', width: 360, height: 800, mobile: true },
  { name: 'mobile-390', width: 390, height: 844, mobile: true },
  { name: 'mobile-430', width: 430, height: 932, mobile: true },
];
const templateCases = [
  {
    id: 'debt-relief-consult',
    label: 'personal-rehabilitation',
    required: ['hero', 'form', 'faq', 'image'],
    gallery: false,
    map: false,
    reservation: false,
  },
  {
    id: 'wedding-invitation',
    label: 'mobile-wedding-invitation',
    required: ['hero', 'form', 'faq', 'image', 'map', 'schedule'],
    gallery: true,
    map: true,
    reservation: false,
  },
  {
    id: 'quote-request',
    label: 'real-estate-presale',
    required: ['hero', 'form', 'faq', 'image', 'map', 'reservation'],
    gallery: true,
    map: true,
    reservation: true,
  },
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

function qaPage(templateId) {
  const page = createTemplatePage(templateId);
  return {
    ...page,
    id: `template-mobile-${templateId}`,
    projectId: `template-mobile-project-${templateId}`,
    ownerId: 'template-mobile-qa-owner',
    status: 'published',
    revision: 1,
    updatedAt: '2026-08-02T00:00:00.000Z',
    share: { ...(page.share || {}), enabled: true, position: 'bottom-right' },
    theme: { ...(page.theme || {}), animOn: false, animPlayback: 'once' },
  };
}

function initScript(page) {
  return `localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(${JSON.stringify(page)}));`;
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result?.value;
}

async function waitForLanding(client) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < 15000) {
    last = await evaluate(client, `(() => ({
      ready: !!document.querySelector('.public-landing-viewport .landing-page')
        && !!document.querySelector('.public-landing-viewport .landing-section.hero')
        && !!document.querySelector('.public-bottom-bar'),
      text: (document.body?.innerText || '').slice(0, 500),
    }))()`);
    if (last?.ready) return;
    await wait(250);
  }
  throw new Error(`Template landing page did not become ready: ${JSON.stringify(last)}`);
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
      return {
        opacity: Number(style.opacity || 1),
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
        display: style.display,
      };
    };
    const visible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.05 && box.width > 0 && box.height > 0;
    };
    const viewport = document.querySelector('.public-landing-viewport');
    const landing = viewport?.querySelector('.landing-page');
    const hero = viewport?.querySelector('.landing-section.hero');
    const heroTitle = hero?.querySelector('h1');
    const heroBody = hero?.querySelector('p');
    const topnav = viewport?.querySelector('.topnav');
    const share = viewport?.querySelector('.page-share-button');
    const bottom = document.querySelector('.public-bottom-bar');
    const bottomButtons = Array.from(bottom?.querySelectorAll('button, a') || []).filter(visible);
    const sections = Array.from(viewport?.querySelectorAll('.landing-section, .landing-footer') || []).filter(visible);
    const faqDetails = Array.from(viewport?.querySelectorAll('.faq-widget details') || []);
    const galleryButtons = Array.from(viewport?.querySelectorAll('.image-sec .gallery-arrows button') || []).filter(visible);
    const galleryDots = Array.from(viewport?.querySelectorAll('.image-sec .dots button') || []).filter(visible);
    const galleryImage = viewport?.querySelector('.image-sec .is-swipeable img');
    const mapSection = viewport?.querySelector('.inlet-map-section');
    const mapActions = Array.from(mapSection?.querySelectorAll('.location-guide-actions a') || []).filter(visible);
    const mapIframe = mapSection?.querySelector('iframe');
    const form = viewport?.querySelector('.landing-section.form:not(.reservation)');
    const reservation = viewport?.querySelector('.landing-section.reservation');
    const active = document.activeElement;
    const bodyText = document.body?.innerText || '';
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      bodyScrollWidth: document.body?.scrollWidth || 0,
      documentScrollWidth: document.documentElement?.scrollWidth || 0,
      documentScrollHeight: document.documentElement?.scrollHeight || 0,
      viewport: rect(viewport),
      landing: rect(landing),
      hero: rect(hero),
      heroTitle: rect(heroTitle),
      heroBody: rect(heroBody),
      heroTitleText: (heroTitle?.innerText || '').trim(),
      heroBodyText: (heroBody?.innerText || '').trim(),
      topnav: rect(topnav),
      share: rect(share),
      bottom: rect(bottom),
      bottomButtons: bottomButtons.map(rect),
      bottomState: state(bottom),
      topnavState: state(topnav),
      shareState: state(share),
      sections: sections.map((element) => ({ className: element.className, box: rect(element) })),
      counts: {
        hero: viewport?.querySelectorAll('.landing-section.hero').length || 0,
        form: viewport?.querySelectorAll('.landing-section.form:not(.reservation)').length || 0,
        reservation: viewport?.querySelectorAll('.landing-section.reservation').length || 0,
        faq: viewport?.querySelectorAll('.faq-widget').length || 0,
        image: viewport?.querySelectorAll('.image-sec').length || 0,
        map: viewport?.querySelectorAll('.inlet-map-section').length || 0,
        schedule: viewport?.querySelectorAll('.schedule-widget').length || 0,
      },
      faqCount: faqDetails.length,
      faqOpenCount: faqDetails.filter((item) => item.open).length,
      galleryButtonCount: galleryButtons.length,
      galleryDotCount: galleryDots.length,
      gallerySrc: galleryImage?.getAttribute('src') || '',
      mapActionCount: mapActions.length,
      mapIframe: rect(mapIframe),
      mapSection: rect(mapSection),
      form: rect(form),
      formControlCount: form?.querySelectorAll('input, textarea, select, button').length || 0,
      reservation: rect(reservation),
      reservationControlCount: reservation?.querySelectorAll('input, textarea, select, button').length || 0,
      activeTag: active?.tagName || '',
      activeWithinForm: !!active?.closest?.('.landing-section.form'),
      formFocusWithin: !!viewport?.querySelector('.landing-section.form:focus-within'),
      activeRect: rect(active),
      placeholderCopy: /이미지를 업로드하세요|대표 이미지를 넣어주세요|장소명 또는 주소를 입력해 주세요|블록을 추가|클릭하여 편집|여기에 입력/i.test(bodyText),
      appError: /화면을 불러오는 중 오류가 발생했습니다|페이지를 찾을 수 없습니다|로컬 저장 페이지와 URL이 일치하지 않습니다/.test(bodyText),
      fallback: !!document.querySelector('.block-render-fallback, .app-error-screen, .error-screen'),
    };
  })()`);
}

function assertInside(child, parent, label, tolerance = 3) {
  assert(child && parent, `${label} bounds are missing`);
  assert(child.left >= parent.left - tolerance, `${label} spills left: ${JSON.stringify({ child, parent })}`);
  assert(child.right <= parent.right + tolerance, `${label} spills right: ${JSON.stringify({ child, parent })}`);
}

function assertVisibleState(value, label) {
  assert(value && value.display !== 'none' && value.visibility !== 'hidden' && value.opacity > 0.5, `${label} is not visible: ${JSON.stringify(value)}`);
}

function assertHiddenState(value, label) {
  if (!value) return;
  const hidden = value.display === 'none' || value.visibility === 'hidden' || value.opacity <= 0.05;
  assert(hidden, `${label} must hide while a form control is focused: ${JSON.stringify(value)}`);
  assert(value.pointerEvents === 'none' || value.display === 'none', `${label} must not receive pointer events while hidden`);
}

function assertBaseline(data, viewport, template) {
  assert(!data.appError, `${template.label}/${viewport.name}: app or public-page error rendered`);
  assert(!data.fallback, `${template.label}/${viewport.name}: block fallback rendered`);
  assert(!data.placeholderCopy, `${template.label}/${viewport.name}: editor or placeholder copy is visible`);
  assert(data.bodyScrollWidth <= viewport.width + 3, `${template.label}/${viewport.name}: body overflow ${data.bodyScrollWidth} > ${viewport.width}`);
  assert(data.documentScrollWidth <= viewport.width + 3, `${template.label}/${viewport.name}: document overflow ${data.documentScrollWidth} > ${viewport.width}`);
  assert(data.viewport?.width <= 414.5, `${template.label}/${viewport.name}: public viewport exceeded 414px`);
  assert(data.viewport?.width <= viewport.width + 1, `${template.label}/${viewport.name}: public viewport exceeded browser width`);
  assertInside(data.landing, data.viewport, `${template.label}/${viewport.name} landing`);
  assertInside(data.hero, data.landing, `${template.label}/${viewport.name} hero`);
  assert(data.hero?.top <= 180, `${template.label}/${viewport.name}: hero starts too low: ${data.hero?.top}`);
  assert(data.hero?.height >= 300, `${template.label}/${viewport.name}: hero is too shallow: ${data.hero?.height}`);
  assert(data.heroTitleText.length >= 8, `${template.label}/${viewport.name}: hero title is missing or too short`);
  assert(data.heroBodyText.length >= 20, `${template.label}/${viewport.name}: hero body is missing or too short`);
  assert(data.heroTitle?.top < viewport.height * 0.72, `${template.label}/${viewport.name}: hero title is not in the first viewport`);
  assert(data.heroTitle?.bottom <= viewport.height + 20, `${template.label}/${viewport.name}: hero title is clipped below the first viewport`);
  assert(data.sections.length >= 8, `${template.label}/${viewport.name}: rendered section count is unexpectedly low`);
  for (const [index, section] of data.sections.entries()) {
    assertInside(section.box, data.landing, `${template.label}/${viewport.name} section ${index + 1}`, 4);
  }
  for (const required of template.required) {
    assert(Number(data.counts?.[required] || 0) >= 1, `${template.label}/${viewport.name}: required ${required} block is missing`);
  }
  assert(data.faqCount >= 3, `${template.label}/${viewport.name}: FAQ does not contain at least three items`);
  assert(data.formControlCount >= 3, `${template.label}/${viewport.name}: form controls are missing`);
  assert(data.bottomButtons.length === 2, `${template.label}/${viewport.name}: expected two bottom actions`);
  assertInside(data.bottom, data.viewport, `${template.label}/${viewport.name} bottom bar`);
  for (const [index, button] of data.bottomButtons.entries()) {
    assertInside(button, data.bottom, `${template.label}/${viewport.name} bottom action ${index + 1}`, 4);
    assert(button.height >= 43, `${template.label}/${viewport.name}: bottom action touch height is below 44px`);
  }
  assertVisibleState(data.bottomState, `${template.label}/${viewport.name} bottom bar`);
  if (data.shareState) {
    assertVisibleState(data.shareState, `${template.label}/${viewport.name} share button`);
    assert(data.share?.bottom <= data.bottom?.top - 4, `${template.label}/${viewport.name}: share button overlaps bottom bar`);
  }
  if (template.gallery) {
    assert(data.galleryButtonCount >= 2, `${template.label}/${viewport.name}: gallery arrows are missing`);
    assert(data.galleryDotCount >= 4, `${template.label}/${viewport.name}: gallery dots are missing`);
  }
  if (template.map) {
    assert(data.mapSection, `${template.label}/${viewport.name}: map section bounds are missing`);
    assert(data.mapActionCount >= 3, `${template.label}/${viewport.name}: map app links are incomplete`);
  }
  if (template.reservation) {
    assert(data.reservationControlCount >= 7, `${template.label}/${viewport.name}: reservation controls are incomplete`);
  }
}

async function clickAt(client, selector) {
  const point = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    element.scrollIntoView({ block: 'center', inline: 'center' });
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, width: box.width, height: box.height };
  })()`);
  assert(point && point.width > 0 && point.height > 0, `Clickable target is missing or has invalid bounds: ${selector}`);
  await wait(180);
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
  await wait(260);
  return point;
}

async function exerciseFaq(client, templateLabel) {
  const before = await evaluate(client, `(() => {
    const item = document.querySelector('.faq-widget details');
    if (!item) return null;
    item.scrollIntoView({ block: 'center' });
    const summary = item.querySelector('summary');
    const box = summary?.getBoundingClientRect();
    return { open: item.open, height: box?.height || 0 };
  })()`);
  assert(before && before.height >= 40, `${templateLabel}: FAQ summary is missing or too small`);
  await clickAt(client, '.faq-widget details summary');
  const toggled = await evaluate(client, `document.querySelector('.faq-widget details')?.open ?? null`);
  assert(toggled === !before.open, `${templateLabel}: FAQ did not toggle`);
  await clickAt(client, '.faq-widget details summary');
  const restored = await evaluate(client, `document.querySelector('.faq-widget details')?.open ?? null`);
  assert(restored === before.open, `${templateLabel}: FAQ did not restore its original state`);
}

async function exerciseGallery(client, templateLabel) {
  const before = await evaluate(client, `(() => {
    const button = document.querySelector('.image-sec .gallery-arrows button[aria-label="다음 이미지"]');
    const image = button?.closest('.image-wrap')?.querySelector('img');
    if (!button || !image) return null;
    button.scrollIntoView({ block: 'center' });
    const box = button.getBoundingClientRect();
    return { src: image.getAttribute('src') || '', width: box.width, height: box.height };
  })()`);
  assert(before && before.width >= 32 && before.height >= 32, `${templateLabel}: gallery next control is missing or too small`);
  await clickAt(client, '.image-sec .gallery-arrows button[aria-label="다음 이미지"]');
  const after = await evaluate(client, `document.querySelector('.image-sec .is-swipeable img')?.getAttribute('src') || ''`);
  assert(after && after !== before.src, `${templateLabel}: gallery did not advance to the next image`);
}

async function exerciseMap(client, templateLabel) {
  const map = await evaluate(client, `(() => {
    const section = document.querySelector('.inlet-map-section');
    if (!section) return null;
    section.scrollIntoView({ block: 'center' });
    const box = section.getBoundingClientRect();
    const links = Array.from(section.querySelectorAll('.location-guide-actions a')).map((link) => {
      const rect = link.getBoundingClientRect();
      return { label: link.textContent.trim(), width: rect.width, height: rect.height, href: link.getAttribute('href') || '' };
    });
    return { box: { left: box.left, right: box.right, width: box.width, height: box.height }, links };
  })()`);
  assert(map && map.box.height >= 240, `${templateLabel}: map section is missing or collapsed`);
  assert(map.links.length >= 3, `${templateLabel}: map provider links are missing`);
  assert(map.links.every((link) => link.width > 0 && link.height >= 36 && /^(https?:\/\/|tmap:\/\/)/i.test(link.href)), `${templateLabel}: map provider link is unusable`);
}

async function exerciseBottomNavigation(client, templateLabel) {
  const target = await evaluate(client, `(() => {
    const button = document.querySelector('.public-bottom-bar button, .public-bottom-bar a');
    if (!button) return null;
    button.click();
    return true;
  })()`);
  assert(target, `${templateLabel}: bottom action is missing`);
  await wait(500);
  const formPosition = await evaluate(client, `(() => {
    const form = document.querySelector('.landing-section.form:not(.reservation)');
    if (!form) return null;
    const box = form.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, height: box.height, viewportHeight: window.innerHeight };
  })()`);
  assert(formPosition && formPosition.top < formPosition.viewportHeight * 0.75 && formPosition.bottom > 80, `${templateLabel}: bottom action did not navigate to the form`);
}

async function exerciseFormKeyboard(client, viewport, templateLabel) {
  const selector = '.landing-section.form:not(.reservation) input:not([type="checkbox"]), .landing-section.form:not(.reservation) textarea, .landing-section.form:not(.reservation) select';
  const prepared = await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) return false;
    input.scrollIntoView({ block: 'center', inline: 'center' });
    return true;
  })()`);
  assert(prepared, `${templateLabel}: form focus target is missing`);
  await clickAt(client, selector);
  const keyboardHeight = Math.max(460, viewport.height - 310);
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: keyboardHeight,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await evaluate(client, `document.activeElement?.scrollIntoView?.({ block: 'center', inline: 'nearest' })`);
  await wait(320);
  const focused = await collectMetrics(client);
  assert(focused.activeWithinForm && focused.formFocusWithin, `${templateLabel}: form focus state was lost`);
  assert(focused.activeRect?.top >= 8 && focused.activeRect?.bottom <= keyboardHeight - 8, `${templateLabel}: active form field is hidden by the simulated keyboard`);
  assertHiddenState(focused.bottomState, `${templateLabel} bottom bar`);
  assertHiddenState(focused.shareState, `${templateLabel} share button`);
  assertHiddenState(focused.topnavState, `${templateLabel} sticky navigation`);
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await evaluate(client, `document.activeElement?.blur?.()`);
  await wait(260);
}

async function exerciseReservation(client, templateLabel) {
  const metrics = await evaluate(client, `(() => {
    const section = document.querySelector('.landing-section.reservation');
    if (!section) return null;
    section.scrollIntoView({ block: 'center' });
    const controls = Array.from(section.querySelectorAll('input, select, button')).filter((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    });
    return controls.map((element) => {
      const box = element.getBoundingClientRect();
      return { tag: element.tagName, type: element.getAttribute('type') || '', width: box.width, height: box.height };
    });
  })()`);
  assert(Array.isArray(metrics) && metrics.length >= 7, `${templateLabel}: reservation controls are incomplete`);
  const invalidControl = metrics.find((control) => {
    const minHeight = ['checkbox', 'radio'].includes(control.type) ? 18 : 36;
    return control.width <= 0 || control.height < minHeight;
  });
  assert(!invalidControl, `${templateLabel}: a reservation control is too small or collapsed: ${JSON.stringify(invalidControl)}`);
}

async function capture(client, file) {
  const image = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  await writeFile(file, Buffer.from(image.data, 'base64'));
  const info = await stat(file);
  assert(info.size > 1500, `Screenshot is too small: ${file}`);
}

async function openPage(port, viewport, template, errors) {
  const page = qaPage(template.id);
  const targetUrl = `${origin}/${page.slug}`;
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  const client = createCdp(target.webSocketDebuggerUrl);
  client.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') errors.push((params.args || []).map((arg) => arg.value || arg.description || '').join(' '));
  });
  client.on('Runtime.exceptionThrown', (params) => errors.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'page exception'));
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: initScript(page) });
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
  await wait(600);
  return { target, client, page, targetUrl };
}

async function closePage(port, target, client) {
  await client.close().catch(() => {});
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
}

const executable = resolveChrome();
assert(executable, 'Chrome/Chromium executable not found. Set INLET_TEMPLATE_MOBILE_QA_CHROME_PATH.');
await rm(screenshotDir, { recursive: true, force: true }).catch(() => {});
await mkdir(screenshotDir, { recursive: true });
const profileDir = await mkdtemp(path.join(tmpdir(), 'inlet-template-mobile-'));
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

  for (const template of templateCases) {
    for (const viewport of viewports) {
      const errors = [];
      const { target, client, targetUrl } = await openPage(debugPort, viewport, template, errors);
      try {
        const baseline = await collectMetrics(client);
        assert(!errors.length, `${template.label}/${viewport.name}: console/runtime errors: ${errors.join(' | ')}`);
        assertBaseline(baseline, viewport, template);
        const baselineFile = path.join(screenshotDir, `${template.label}-${viewport.name}-first-viewport.png`);
        await capture(client, baselineFile);

        await exerciseFaq(client, template.label);
        if (template.gallery) await exerciseGallery(client, template.label);
        if (template.map) await exerciseMap(client, template.label);
        if (template.reservation) await exerciseReservation(client, template.label);

        if (viewport.name === 'mobile-390') {
          await exerciseBottomNavigation(client, template.label);
          await exerciseFormKeyboard(client, viewport, template.label);
          const interactionFile = path.join(screenshotDir, `${template.label}-${viewport.name}-interaction.png`);
          await capture(client, interactionFile);
        }

        assert(!errors.length, `${template.label}/${viewport.name}: interaction console/runtime errors: ${errors.join(' | ')}`);
        results.push({
          template: template.id,
          label: template.label,
          viewport: viewport.name,
          targetUrl,
          screenshot: baselineFile,
          heroTitle: baseline.heroTitleText,
          sections: baseline.sections.length,
          faqItems: baseline.faqCount,
          galleryControls: baseline.galleryButtonCount,
          mapLinks: baseline.mapActionCount,
          reservationControls: baseline.reservationControlCount,
        });
      } finally {
        await closePage(debugPort, target, client);
      }
    }
  }
} finally {
  browser.kill('SIGTERM');
  await wait(500);
  if (!browser.killed) browser.kill('SIGKILL');
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}

assert(results.length === templateCases.length * viewports.length, `Expected ${templateCases.length * viewports.length} template/mobile results, got ${results.length}`);
console.log(JSON.stringify({
  ok: true,
  check: 'three-template-mobile-final-regression',
  engine: 'chrome-cdp',
  executable,
  screenshotDir,
  templates: templateCases.map((item) => item.id),
  viewports: viewports.map((item) => item.name),
  results,
}, null, 2));
