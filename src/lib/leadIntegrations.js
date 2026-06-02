import { normalizeIntegrations, uid } from './pageModel.js';
import { BRAND_NAME } from '../config/brand.js';
import { publicLandingUrl, runtimeConfig } from '../config/runtimeConfig.js';
import { trackingConfig } from './conversionTracking.js';

export const CONNECTION_STATUS = {
  off: '꺼짐',
  needsSetup: '설정 필요',
  ready: '준비됨',
  failed: '실패',
};

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
    custom: '직접 연결',
    crm: 'CRM',
    server: '서버',
    make: 'Make',
    zapier: 'Zapier',
    n8n: 'n8n',
    google_sheets: 'Google Sheets',
  }[key] || key;
}

function readyOrFailed(section = {}) {
  return section.lastStatus === 'failed'
    ? { tone: 'fail', text: CONNECTION_STATUS.failed }
    : { tone: 'ok', text: CONNECTION_STATUS.ready };
}

export function connectionState(type, integrations) {
  if (type === 'internal') return { tone: 'ok', text: CONNECTION_STATUS.ready, hint: '?? ?? ??' };
  if (type === 'google') {
    if (integrations.google.connected) return { tone: 'ok', text: CONNECTION_STATUS.ready, hint: integrations.google.email || 'Google ?? ??' };
    return { tone: 'warn', text: CONNECTION_STATUS.needsSetup, hint: 'Google OAuth ?? ??' };
  }
  if (type === 'email') {
    if (!integrations.email.enabled) return { tone: 'off', text: CONNECTION_STATUS.off, hint: '??? ?? ??' };
    if (!isValidEmail(integrations.email.to)) return { tone: 'warn', text: CONNECTION_STATUS.needsSetup, hint: '?? ??? ?? ?? ??' };
    return { ...readyOrFailed(integrations.email), hint: integrations.email.to };
  }
  if (type === 'webhook') {
    if (!integrations.webhook.enabled) return { tone: 'off', text: CONNECTION_STATUS.off, hint: 'Webhook ??' };
    if (!isValidUrl(integrations.webhook.url)) return { tone: 'warn', text: CONNECTION_STATUS.needsSetup, hint: '?? URL ?? ??' };
    return { ...readyOrFailed(integrations.webhook), hint: integrations.webhook.url };
  }
  if (type === 'automation') {
    if (!integrations.automation.enabled) return { tone: 'off', text: CONNECTION_STATUS.off, hint: 'Make/Zapier ??' };
    if (!isValidUrl(integrations.automation.url)) return { tone: 'warn', text: CONNECTION_STATUS.needsSetup, hint: 'Make/Zapier Webhook URL ?? ??' };
    return { ...readyOrFailed(integrations.automation), hint: serviceLabel(integrations.automation.service || 'make') + ' ??' };
  }
  if (type === 'sheets') {
    if (!integrations.sheets.enabled) return { tone: 'off', text: CONNECTION_STATUS.off, hint: 'Google Sheets ??' };
    if (!isValidUrl(integrations.sheets.webhookUrl || integrations.sheets.url)) return { tone: 'warn', text: CONNECTION_STATUS.needsSetup, hint: 'Google Sheets URL ?? ??' };
    return { ...readyOrFailed(integrations.sheets), hint: integrations.sheets.sheetName || '???' };
  }
  if (type === 'calendar') {
    if (integrations.calendar.connected) return { tone: 'ok', text: CONNECTION_STATUS.ready, hint: integrations.calendar.calendarName || 'Google Calendar ?? ??' };
    return { tone: 'warn', text: CONNECTION_STATUS.needsSetup, hint: 'Google Calendar OAuth ?? ??' };
  }
  return { tone: 'off', text: CONNECTION_STATUS.off, hint: '' };
}

export function connectionCounts(integrations) {
  const keys = ['internal', 'google', 'email', 'webhook', 'automation', 'sheets', 'calendar'];
  const states = keys.map((key) => connectionState(key, integrations));
  return {
    ok: states.filter((state) => state.tone === 'ok').length,
    warn: states.filter((state) => state.tone === 'warn').length,
    ready: states.filter((state) => state.tone === 'ready').length,
    failed: states.filter((state) => state.tone === 'fail').length,
  };
}

export async function runConnectionTest(type, page) {
  const integrations = normalizeIntegrations(page.integrations || {});
  const lead = makeSampleLead();
  const payload = integrationPayload(lead, page);
  if (type === 'internal') return { ok: true, status: CONNECTION_STATUS.ready, message: '?? ??? ???? ???? ????.' };
  if (type === 'google' || type === 'calendar') return { ok: false, status: CONNECTION_STATUS.needsSetup, message: 'Google OAuth ??? ?????.' };
  if (type === 'email') {
    if (!integrations.email.enabled) return { ok: false, status: CONNECTION_STATUS.off, message: '??? ??? ?? ????.' };
    if (!isValidEmail(integrations.email.to)) return { ok: false, status: CONNECTION_STATUS.needsSetup, message: '?? ??? ?? ??? ?????.' };
    return { ok: true, status: CONNECTION_STATUS.ready, message: '??? ?? ??? ??????. ?? ??? ?? ?? ? ???? ?????.' };
  }
  if (type === 'webhook') {
    if (!integrations.webhook.enabled) return { ok: false, status: CONNECTION_STATUS.off, message: 'Webhook? ?? ????.' };
    if (!isValidUrl(integrations.webhook.url)) return { ok: false, status: CONNECTION_STATUS.needsSetup, message: 'Webhook ?? URL ??? ?????.' };
    const res = await postIntegration(integrations.webhook.url, { ...payload, target: 'webhook', service: integrations.webhook.service || 'custom' }, { format: 'json', secret: integrations.webhook.secret || '' });
    return { ok: !!res.ok, status: res.ok ? CONNECTION_STATUS.ready : CONNECTION_STATUS.failed, message: res.ok ? 'Webhook ??? ?? ??' : 'Webhook ?? ??: ' + (res.status || '?? ?? ??') };
  }
  if (type === 'automation') {
    if (!integrations.automation.enabled) return { ok: false, status: CONNECTION_STATUS.off, message: 'Make/Zapier ??? ?? ????.' };
    if (!isValidUrl(integrations.automation.url)) return { ok: false, status: CONNECTION_STATUS.needsSetup, message: 'Make/Zapier Webhook URL ??? ?????.' };
    const res = await postIntegration(integrations.automation.url, { ...payload, target: 'automation', service: integrations.automation.service || 'make' }, { format: 'json', secret: integrations.automation.secret || '' });
    return { ok: !!res.ok, status: res.ok ? CONNECTION_STATUS.ready : CONNECTION_STATUS.failed, message: res.ok ? serviceLabel(integrations.automation.service || 'make') + ' ??? ?? ??' : 'Make/Zapier ?? ??: ' + (res.status || '?? ?? ??') };
  }
  if (type === 'sheets') {
    const sheetsUrl = integrations.sheets.webhookUrl || integrations.sheets.url;
    if (!integrations.sheets.enabled) return { ok: false, status: CONNECTION_STATUS.off, message: 'Google Sheets ??? ?? ????.' };
    if (!isValidUrl(sheetsUrl)) return { ok: false, status: CONNECTION_STATUS.needsSetup, message: 'Google Sheets Webhook URL? ??????.' };
    const sheetsPayload = googleSheetsPayload(payload, integrations.sheets, page, lead);
    try {
      const res = await postJson('/api/integrations/test', {
        type: 'sheets',
        url: sheetsUrl,
        sheetName: integrations.sheets.sheetName || '???',
        page: sheetsPayload.page,
        project: sheetsPayload.project,
        payload: sheetsPayload,
      });
      return { ok: !!res.ok, status: res.ok ? CONNECTION_STATUS.ready : CONNECTION_STATUS.failed, message: res.message || 'Google Sheets? ??? ?? ?????. ??? ??????.' };
    } catch (error) {
      return { ok: false, status: CONNECTION_STATUS.failed, message: 'Google Sheets ??? ??: ' + String(error?.message || error) };
    }
  }
  return { ok: false, status: CONNECTION_STATUS.needsSetup, message: '??? ? ?? ?????.' };
}
export function integrationPayload(lead, page) {
  const createdAt = lead.createdAt || new Date().toISOString();
  return {
    brand: BRAND_NAME,
    schemaVersion: 'inlet.lead.v1',
    event: 'lead.created',
    source: 'inlet',
    page: {
      title: page.title,
      slug: page.slug,
      url: publicLandingUrl(page.slug || ''),
    },
    lead,
    contact: {
      name: lead.name || lead.values?.name || '',
      phone: lead.phone || lead.values?.phone || '',
      email: lead.email || lead.values?.email || '',
    },
    createdAt,
  };
}

export function googleSheetsPayload(payload = {}, sheets = {}, page = {}, lead = {}) {
  const fields = { ...(lead.values || {}) };
  for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
    const key = answer.label || answer.id;
    if (key) fields[key] = Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '');
  }
  const slug = page.slug || payload.page?.slug || '';
  return {
    schemaVersion: payload.schemaVersion || 'inlet.lead.v1',
    event: payload.event || 'lead.created',
    source: payload.source || 'pagero',
    target: 'google_sheets',
    provider: 'google_sheets',
    mode: sheets.mode || 'webhook',
    sheetName: sheets.sheetName || '접수함',
    lead: {
      id: lead.id || payload.lead?.id || '',
      name: lead.name || payload.contact?.name || '',
      phone: lead.phone || payload.contact?.phone || '',
      email: lead.email || payload.contact?.email || '',
      message: lead.message || '',
      createdAt: lead.createdAt || payload.createdAt || new Date().toISOString(),
      fields,
    },
    page: {
      id: page.id || page.projectId || '',
      title: page.title || payload.page?.title || '',
      slug,
      url: payload.page?.url || publicLandingUrl(slug),
    },
    project: {
      id: page.projectId || page.id || '',
    },
    attribution: {
      utmSource: lead.utmSource || '',
      utmMedium: lead.utmMedium || '',
      utmCampaign: lead.utmCampaign || '',
      referrer: lead.referrer || '',
      sourceUrl: lead.sourceUrl || '',
    },
    createdAt: lead.createdAt || payload.createdAt || new Date().toISOString(),
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

  const eventName = lead.type === '방문 예약' || lead.type === '방문예약' ? 'reservation_submit' : 'lead_submit';
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
    pending: '확인 필요',
    success: '준비됨',
    failed: '실패',
    partial: '확인 필요',
    none: '꺼짐',
  };
  return map[status] || CONNECTION_STATUS.off;
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
      options: { format: 'json', secret: integrations.webhook.secret || '' },
    });
  }

  if (integrations.automation.enabled && integrations.automation.url) {
    jobs.push({
      id: 'automation',
      label: `자동화 · ${serviceLabel(integrations.automation.service || 'make')}`,
      url: integrations.automation.url,
      payload: { ...payload, target: 'automation', service: integrations.automation.service || 'make' },
      options: { format: 'json', secret: integrations.automation.secret || '' },
    });
  }

  if (integrations.sheets.enabled && (integrations.sheets.webhookUrl || integrations.sheets.url)) {
    jobs.push({
      id: 'google_sheets',
      label: 'Google Sheets',
      url: integrations.sheets.webhookUrl || integrations.sheets.url,
      payload: googleSheetsPayload(payload, integrations.sheets, payload.page || {}, payload.lead || {}),
      options: { format: 'json', secret: integrations.sheets.secret || '' },
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
      provider: job.id,
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
      provider: job?.id || 'unknown',
      status: 'failed',
      message: String(item.reason?.message || item.reason || '전송 실패'),
      at: new Date().toISOString(),
    };
  });

  const safeLogs = logs.slice(-20);
  const summary = summarizeDelivery(safeLogs);
  return { ...summary, logs: safeLogs };
}

export function makeSampleLead(type = '상담 신청') {
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
      name: '김테스트',
      phone: '010-0000-0000',
      email: 'test@example.com',
      message: '연동 테스트 접수입니다.',
    },
    answers: [
      { id: 'name', label: '이름', type: 'name', value: '김테스트' },
      { id: 'phone', label: '연락처', type: 'phone', value: '010-0000-0000' },
      { id: 'message', label: '문의내용', type: 'long', value: '연동 테스트 접수입니다.' },
    ],
  };
}
