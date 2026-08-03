import { installConversionTracking, trackingConfig } from '../src/lib/conversionTracking.js';
import { sendConversionIntegrations } from '../src/lib/leadIntegrations.js';

const APPROVED_SCRIPT_HOSTS = new Set([
  'www.googletagmanager.com',
  'connect.facebook.net',
  'wcs.naver.net',
  't1.daumcdn.net',
]);

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function boundedTimeout(value = 12_000) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return 12_000;
  return Math.max(3_000, Math.min(30_000, parsed));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), boundedTimeout(timeoutMs));
  try {
    return await fetch(url, {
      ...options,
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') fail('conversion verification request timed out', { timeoutMs: boundedTimeout(timeoutMs) });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function publicPageTarget(origin = '', slug = '') {
  const target = new URL(`/api/pages/${encodeURIComponent(slug)}?public=1`, `${origin}/`);
  if (target.origin !== origin) fail('cross-origin public page request blocked');
  if (target.pathname !== `/api/pages/${encodeURIComponent(slug)}` || target.search !== '?public=1') {
    fail('public page endpoint contract mismatch');
  }
  return target;
}

async function loadPublicPage(origin, slug, timeoutMs) {
  const target = publicPageTarget(origin, slug);
  const response = await fetchWithTimeout(target, { headers: { Accept: 'application/json' } }, timeoutMs);
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    fail('public page endpoint returned invalid JSON', { status: response.status });
  }
  if (!response.ok || payload?.ok !== true || !payload?.page) {
    const error = new Error('conversion fixture public page is unavailable');
    error.status = response.status;
    throw error;
  }
  return payload.page;
}

function fakeDocument() {
  const nodes = new Map();
  return {
    nodes,
    head: {
      appendChild(node) {
        if (node.id) nodes.set(node.id, node);
      },
    },
    createElement(tag) {
      return { tag, id: '', async: false, src: '' };
    },
    getElementById(id) {
      return nodes.get(id) || null;
    },
  };
}

function fakeWindow() {
  const win = {
    dataLayer: [],
    fbqCalls: [],
    gtagCalls: [],
    kakaoCalls: 0,
    naverCalls: 0,
    fbq(...args) {
      win.fbqCalls.push(args);
    },
    gtag(...args) {
      win.gtagCalls.push(args);
    },
    kakaoPixel() {
      return { completeRegistration: () => { win.kakaoCalls += 1; } };
    },
    wcs: true,
    wcs_add: {},
    wcs_do() {
      win.naverCalls += 1;
    },
  };
  return win;
}

function configuredChannels(config = {}) {
  return [
    config.gtmId ? 'gtm' : '',
    config.ga4Id ? 'ga4' : '',
    config.metaPixelId ? 'meta' : '',
    config.googleAdsId ? 'googleAds' : '',
    config.naverId ? 'naver' : '',
    config.kakaoPixelId ? 'kakao' : '',
  ].filter(Boolean);
}

function validateFixture(page = {}) {
  if (!String(page.slug || '').startsWith('qa-conversion-')) fail('public fixture slug is not dedicated to conversion QA');
  if (!/^qa(?:\s|[-_:]|$)/i.test(String(page.title || '').trim())) fail('conversion fixture page title must start with QA');
  const config = trackingConfig(page);
  const channels = configuredChannels(config);
  if (!config.enabled) fail('conversion tracking is disabled on the fixture page');
  if (!channels.length) fail('conversion fixture has no configured tracking channel');
  if (config.gtmId && !config.dataLayer) fail('GTM fixture requires dataLayer conversion events');
  return { config, channels };
}

function validateScriptTargets(doc) {
  const hosts = [];
  for (const node of doc.nodes.values()) {
    if (!node.src) continue;
    const parsed = new URL(node.src);
    if (parsed.protocol !== 'https:' || !APPROVED_SCRIPT_HOSTS.has(parsed.hostname)) {
      fail('unapproved conversion script target', { hostname: parsed.hostname });
    }
    hosts.push(parsed.hostname);
  }
  return [...new Set(hosts)].sort();
}

function resetEventCapture(win) {
  win.dataLayer.length = 0;
  win.fbqCalls.length = 0;
  win.gtagCalls.length = 0;
  win.kakaoCalls = 0;
  win.naverCalls = 0;
}

function captureSnapshot(win) {
  return {
    dataLayer: win.dataLayer,
    fbqCalls: win.fbqCalls,
    gtagCalls: win.gtagCalls,
    kakaoCalls: win.kakaoCalls,
    naverCalls: win.naverCalls,
  };
}

function assertNoCustomerData(capture, secrets = []) {
  const serialized = JSON.stringify(capture);
  for (const secret of secrets) {
    if (secret && serialized.includes(secret)) fail('conversion event exposed fixture customer data');
  }
  if (/lead_id/i.test(serialized)) fail('conversion event exposed a raw lead identifier field');
}

function verifyDispatch(page, config) {
  const doc = fakeDocument();
  const win = fakeWindow();
  installConversionTracking(page, win, doc);
  const scriptHosts = validateScriptTargets(doc);
  resetEventCapture(win);

  const consultation = {
    id: 'qa-private-consultation-id',
    type: '상담 신청',
    name: 'QA 비공개 이름',
    phone: '010-1111-2222',
    email: 'qa-private@example.com',
  };
  const first = sendConversionIntegrations(consultation, page, win);
  if (!first.sent || first.eventName !== 'lead_submit') fail('consultation conversion dispatch failed');
  if (config.dataLayer && !win.dataLayer.some((item) => item.event === 'lead_submit')) fail('lead_submit dataLayer event missing');
  if (config.ga4Id && !win.gtagCalls.some((call) => call[0] === 'event' && call[1] === 'lead_submit')) fail('GA4 lead_submit event missing');
  if (config.metaPixelId && !win.fbqCalls.some((call) => call[0] === 'track' && call[1] === 'Lead')) fail('Meta Lead event missing');
  if (config.googleAdsId && !win.gtagCalls.some((call) => call[0] === 'event' && call[1] === 'conversion')) fail('Google Ads conversion event missing');
  assertNoCustomerData(captureSnapshot(win), [consultation.id, consultation.name, consultation.phone, consultation.email]);

  const beforeDuplicate = JSON.stringify(captureSnapshot(win));
  const duplicate = sendConversionIntegrations(consultation, page, win);
  const afterDuplicate = JSON.stringify(captureSnapshot(win));
  if (!duplicate.duplicate || beforeDuplicate !== afterDuplicate) fail('duplicate consultation conversion was not suppressed');

  const reservation = {
    id: 'qa-private-reservation-id',
    type: '방문 예약',
    name: 'QA 예약자',
    phone: '010-3333-4444',
  };
  const scheduled = sendConversionIntegrations(reservation, page, win);
  if (!scheduled.sent || scheduled.eventName !== 'reservation_submit') fail('reservation conversion dispatch failed');
  if (config.dataLayer && !win.dataLayer.some((item) => item.event === 'reservation_submit')) fail('reservation_submit dataLayer event missing');
  if (config.ga4Id && !win.gtagCalls.some((call) => call[0] === 'event' && call[1] === 'reservation_submit')) fail('GA4 reservation_submit event missing');
  if (config.metaPixelId && !win.fbqCalls.some((call) => call[0] === 'track' && call[1] === 'Schedule')) fail('Meta Schedule event missing');
  assertNoCustomerData(captureSnapshot(win), [reservation.id, reservation.name, reservation.phone]);

  return {
    scriptHosts,
    consultationChannels: first.channels,
    reservationChannels: scheduled.channels,
    duplicateSuppressed: true,
    customerDataIncluded: false,
  };
}

function safeFailure(error = {}) {
  return {
    message: String(error?.message || error || 'unknown error').slice(0, 300),
    status: Number(error?.status || 0) || undefined,
  };
}

export async function runConversionProductionCheck(env = process.env) {
  if (env.INLET_CONVERSION_ORIGIN_VERIFIED !== '1') fail('safe conversion entrypoint is required');
  const origin = String(env.INLET_CONVERSION_BASE_URL || '').trim();
  const slug = String(env.INLET_CONVERSION_PAGE_SLUG || '').trim().toLowerCase();
  const requireLive = String(env.INLET_CONVERSION_REQUIRE_LIVE || '1') === '1';

  let page;
  try {
    page = await loadPublicPage(origin, slug, env.INLET_CONVERSION_TIMEOUT_MS);
  } catch (error) {
    if (!requireLive) {
      const output = {
        ok: true,
        status: 'skipped-live',
        reason: safeFailure(error),
        writesPerformed: false,
        externalAdRequestsPerformed: false,
        identifiersIncluded: false,
        customerDataIncluded: false,
      };
      console.log(JSON.stringify(output, null, 2));
      return output;
    }
    throw error;
  }

  const { config, channels } = validateFixture(page);
  const dispatch = verifyDispatch(page, config);
  const output = {
    ok: true,
    status: 'verified-live',
    fixture: { dedicatedSlug: true, qaTitle: true },
    configuredChannels: channels,
    installedScriptHosts: dispatch.scriptHosts,
    consultationEvent: 'lead_submit',
    reservationEvent: 'reservation_submit',
    duplicateSuppressed: dispatch.duplicateSuppressed,
    directGa4Verified: !config.ga4Id || dispatch.consultationChannels.includes('ga4'),
    metaSemanticsVerified: !config.metaPixelId || dispatch.reservationChannels.includes('meta'),
    writesPerformed: false,
    externalAdRequestsPerformed: false,
    identifiersIncluded: false,
    customerDataIncluded: false,
  };
  console.log(JSON.stringify(output, null, 2));
  return output;
}
