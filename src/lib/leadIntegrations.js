import { normalizeIntegrations, uid } from './pageModel.js';
import { BRAND_NAME } from '../config/brand.js';
import { runtimeConfig } from '../config/runtimeConfig.js';
import { trackingConfig } from './conversionTracking.js';

export function isValidUrl(value = '') {
  try {
    const url = new URL(String(value).trim());
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export function serviceLabel(key = '') {
  return {
    custom: '직접',
    crm: 'CRM',
    server: '서버',
    make: 'Make',
    zapier: 'Zapier',
    n8n: 'n8n',
  }[key] || key;
}

export function connectionState(type, integrations) {
  if (type === 'internal') return { tone: 'ok', text: '저장중', hint: '기본 저장소' };

  if (type === 'google') {
    if (integrations.google.connected) return { tone: 'ok', text: '연결됨', hint: integrations.google.email || 'Google 연결 완료' };
    return { tone: 'ready', text: '준비중', hint: '정식 서버 연결 후 활성화' };
  }

  if (type === 'email') {
    if (!integrations.email.enabled) return { tone: 'off', text: '꺼짐', hint: '이메일 알림 미사용' };
    if (!isValidEmail(integrations.email.to)) return { tone: 'warn', text: '확인필요', hint: '받을 이메일을 확인하세요' };
    return { tone: 'ok', text: '준비됨', hint: integrations.email.to };
  }

  if (type === 'webhook') {
    if (!integrations.webhook.enabled) return { tone: 'off', text: '꺼짐', hint: 'Webhook 미사용' };
    if (!isValidUrl(integrations.webhook.url)) return { tone: 'warn', text: '확인필요', hint: '전송 URL을 확인하세요' };
    return { tone: 'ok', text: '준비됨', hint: integrations.webhook.url };
  }

  if (type === 'automation') {
    if (!integrations.automation.enabled) return { tone: 'off', text: '꺼짐', hint: '자동화 미사용' };
    if (!isValidUrl(integrations.automation.url)) return { tone: 'warn', text: '확인필요', hint: '자동화 URL을 확인하세요' };
    return { tone: 'ok', text: '준비됨', hint: `${String(integrations.automation.service || 'make').toUpperCase()} 연결` };
  }

  if (type === 'calendar') {
    if (integrations.calendar.connected) return { tone: 'ok', text: '연결됨', hint: integrations.calendar.calendarName || '캘린더 연결 완료' };
    return { tone: 'ready', text: '준비중', hint: 'Google Calendar 연결 후 활성화' };
  }

  return { tone: 'off', text: '꺼짐', hint: '' };
}

export function connectionCounts(integrations) {
  const keys = ['internal', 'google', 'email', 'webhook', 'automation', 'calendar'];
  const states = keys.map((key) => connectionState(key, integrations));
  return {
    ok: states.filter((state) => state.tone === 'ok').length,
    warn: states.filter((state) => state.tone === 'warn').length,
    ready: states.filter((state) => state.tone === 'ready').length,
  };
}

export async function runConnectionTest(type, page) {
  const integrations = normalizeIntegrations(page.integrations || {});
  const lead = makeSampleLead(type === 'reservation' ? '방문예약' : '상담신청');
  const payload = integrationPayload(lead, page);

  if (type === 'internal') return { ok: true, message: '내부 접수함 저장은 기본으로 활성화되어 있습니다.' };
  if (type === 'google') return { ok: false, message: 'Google 연결은 정식 서버와 OAuth 연결 후 테스트할 수 있습니다.' };

  if (type === 'email') {
    if (!integrations.email.enabled) return { ok: false, message: '이메일 알림을 먼저 켜주세요.' };
    if (!isValidEmail(integrations.email.to)) return { ok: false, message: '받을 이메일 주소를 확인해주세요.' };
    return { ok: true, message: '이메일 설정은 정상입니다. 실제 발송은 정식 서버의 발신 메일에서 처리합니다.' };
  }

  if (type === 'webhook') {
    if (!integrations.webhook.enabled) return { ok: false, message: 'Webhook 사용을 먼저 켜주세요.' };
    if (!isValidUrl(integrations.webhook.url)) return { ok: false, message: '전송 URL을 확인해주세요.' };
    const res = await postIntegration(integrations.webhook.url, { ...payload, target: 'webhook', service: integrations.webhook.service || 'custom' }, { format: 'json' });
    return { ok: !!res.ok, message: res.ok ? 'Webhook 테스트 전송이 완료되었습니다.' : `Webhook 응답을 확인해주세요. 상태: ${res.status || '확인 불가'}` };
  }

  if (type === 'automation') {
    if (!integrations.automation.enabled) return { ok: false, message: '자동화 연결을 먼저 켜주세요.' };
    if (!isValidUrl(integrations.automation.url)) return { ok: false, message: '자동화 URL을 확인해주세요.' };
    const res = await postIntegration(integrations.automation.url, { ...payload, target: 'automation', service: integrations.automation.service || 'make' }, { format: 'json' });
    return { ok: !!res.ok, message: res.ok ? '자동화 서비스 테스트 전송이 완료되었습니다.' : `자동화 서비스 응답을 확인해주세요. 상태: ${res.status || '확인 불가'}` };
  }

  if (type === 'calendar') return { ok: false, message: '캘린더 연결은 Google Calendar OAuth 연결 후 테스트할 수 있습니다.' };

  return { ok: false, message: '확인할 수 없는 연결입니다.' };
}

export function integrationPayload(lead, page) {
  return {
    brand: BRAND_NAME,
    page: {
      title: page.title,
      slug: page.slug,
      url: `${location.origin}/${page.slug || ''}`,
    },
    lead,
    createdAt: lead.createdAt,
  };
}

export async function postIntegration(url, payload, options = {}) {
  if (!url) return { ok: false, reason: 'URL 없음' };

  const body = JSON.stringify(payload);
  const timeoutMs = integrationTimeoutMs(options);
  if (options.format === 'nocors') {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    }, timeoutMs);
    if (res?.timedOut) return res;
    return { ok: true, opaque: true };
  }

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      ...(options.secret ? { 'X-Inlet-Secret': options.secret } : {}),
    },
    body,
  }, timeoutMs);

  return { ok: res.ok, status: res.status };
}

function integrationTimeoutMs(options = {}) {
  const value = Number(options.timeoutMs || runtimeConfig.leadIntegrationTimeoutMs || 10000);
  return Number.isFinite(value) ? Math.max(1000, value) : 10000;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') return { ok: false, status: 504, timedOut: true };
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function sendConversionIntegrations(lead, page) {
  const config = trackingConfig(page);
  if (!config.enabled) return;

  const eventName = lead.type === '방문예약' ? 'reservation_submit' : 'lead_submit';
  const payload = {
    event: eventName,
    lead_type: lead.type,
    page_slug: page.slug,
    lead_id: lead.id,
  };

  if (config.dataLayer) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  }

  if (config.metaPixelId && typeof window.fbq === 'function') window.fbq('track', 'Lead', payload);

  if (config.googleAdsId && typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', {
      ...payload,
      ...(config.googleAdsSendTo || window.inletGoogleAdsSendTo ? { send_to: config.googleAdsSendTo || window.inletGoogleAdsSendTo } : {}),
    });
  }

  if (config.kakaoPixelId && window.kakaoPixelId && typeof window.kakaoPixel === 'function') {
    window.kakaoPixel(window.kakaoPixelId).completeRegistration();
  }

  if (config.naverId && window.wcs) {
    window.wcs_add = window.wcs_add || {};
    window.wcs_do?.();
  }
}

export function deliveryStatusLabel(status = 'none') {
  const map = {
    pending: '전송중',
    success: '전송완료',
    failed: '전송실패',
    partial: '일부실패',
    none: '미연결',
  };
  return map[status] || '미연결';
}

export function deliveryStatusClass(status = 'none') {
  if (status === 'success') return 'success';
  if (status === 'pending') return 'pending';
  if (status === 'failed' || status === 'partial') return 'failed';
  return 'none';
}

export function buildIntegrationJobs(integrations, payload) {
  const jobs = [];

  if (integrations.webhook.enabled && integrations.webhook.url) {
    jobs.push({
      id: 'webhook',
      label: 'Webhook',
      url: integrations.webhook.url,
      payload: { ...payload, target: 'webhook', service: integrations.webhook.service || 'custom' },
      options: { format: 'json' },
    });
  }

  if (integrations.automation.enabled && integrations.automation.url) {
    jobs.push({
      id: 'automation',
      label: `자동화 · ${serviceLabel(integrations.automation.service || 'make')}`,
      url: integrations.automation.url,
      payload: { ...payload, target: 'automation', service: integrations.automation.service || 'make' },
      options: { format: 'json' },
    });
  }

  if (integrations.sheets.enabled && integrations.sheets.url) {
    jobs.push({
      id: 'google_sheets_manual',
      label: 'Google 시트',
      url: integrations.sheets.url,
      payload: {
        ...payload,
        target: 'google_sheets',
        sheetName: integrations.sheets.sheetName || '접수함',
        emailEnabled: !!integrations.sheets.emailEnabled,
        notifyEmail: integrations.sheets.notifyEmail || '',
      },
      options: { format: 'nocors' },
    });
  }

  return jobs;
}

export function summarizeDelivery(logs = []) {
  if (!logs.length) return { status: 'none', summary: '외부 전송 없음' };
  const ok = logs.filter((item) => item.status === 'success').length;
  const fail = logs.filter((item) => item.status === 'failed').length;

  if (ok && !fail) return { status: 'success', summary: `${ok}개 연결 전송 완료` };
  if (ok && fail) return { status: 'partial', summary: `${ok}개 성공 · ${fail}개 실패` };
  return { status: 'failed', summary: `${fail}개 연결 전송 실패` };
}

export async function sendLeadIntegrations(lead, page) {
  const integrations = normalizeIntegrations(page.integrations || {});
  const payload = integrationPayload(lead, page);

  sendConversionIntegrations(lead, page);

  const jobs = buildIntegrationJobs(integrations, payload);
  if (!jobs.length) return { status: 'none', summary: '외부 전송 없음', logs: [] };

  const settled = await Promise.allSettled(jobs.map(async (job) => {
    const res = await postIntegration(job.url, job.payload, job.options);
    return {
      target: job.label,
      status: res?.ok ? 'success' : 'failed',
      message: res?.ok ? '전송 완료' : `응답 확인 필요${res?.status ? ` · ${res.status}` : ''}`,
      at: new Date().toISOString(),
    };
  }));

  const logs = settled.map((item, idx) => {
    const job = jobs[idx];
    if (item.status === 'fulfilled') return item.value;
    return {
      target: job?.label || '외부 전송',
      status: 'failed',
      message: String(item.reason?.message || item.reason || '전송 실패'),
      at: new Date().toISOString(),
    };
  });

  const safeLogs = logs.slice(-20);
  const summary = summarizeDelivery(safeLogs);
  return { ...summary, logs: safeLogs };
}

export function makeSampleLead(type = '상담신청') {
  return {
    id: uid(),
    status: '신규',
    memo: '',
    createdAt: new Date().toISOString(),
    type,
    name: '김테스트',
    phone: '010-0000-0000',
    email: 'test@example.com',
    address: '서울시 테스트구',
    message: '연동 테스트 접수입니다.',
    values: {
      이름: '김테스트',
      연락처: '010-0000-0000',
      문의내용: '연동 테스트 접수입니다.',
    },
    answers: [
      { id: 'name', label: '이름', type: 'name', value: '김테스트' },
      { id: 'phone', label: '연락처', type: 'phone', value: '010-0000-0000' },
      { id: 'message', label: '문의내용', type: 'long', value: '연동 테스트 접수입니다.' },
    ],
  };
}
