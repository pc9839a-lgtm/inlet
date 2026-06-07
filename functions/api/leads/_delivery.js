import { isValidEmailAddress, sendSesEmail } from '../_ses.js';
import {
  appendGoogleSheetRow,
  getGoogleSheetsIntegration,
  googleClientId,
  googleClientSecret,
  googleSheetsPayloadRow,
  mergeGoogleTokens,
  refreshGoogleAccessToken,
  updateGoogleSheetsIntegrationStatus,
} from '../integrations/google/sheets/_oauth.js';

const SUPPORT_EMAIL = 'support@pagero.kr';
export const NO_DELIVERY_SETTINGS_MESSAGE = '\uC804\uC1A1 \uC124\uC815 \uC5C6\uC74C';

export function deliveryReport(status = 'none', summary = NO_DELIVERY_SETTINGS_MESSAGE, logs = []) {
  return { status, summary, logs };
}

export function normalizeDeliveryPage(inputPage = {}, storedPage = {}, project = {}) {
  const storedIntegrations = storedPage.integrations || {};
  const inputIntegrations = inputPage.integrations || {};
  const hasStoredDeliverySettings = !!(
    storedIntegrations.email
    || storedIntegrations.webhook
    || storedIntegrations.automation
    || storedIntegrations.sheets
  );
  const integrations = hasStoredDeliverySettings
    ? {
      ...storedIntegrations,
      conversion: {
        ...(storedIntegrations.conversion || {}),
        ...(inputIntegrations.conversion || {}),
      },
    }
    : inputIntegrations;

  return {
    ...storedPage,
    ...inputPage,
    title: inputPage.title || storedPage.title || project.title || project.slug || '',
    slug: inputPage.slug || storedPage.slug || project.slug || '',
    integrations,
  };
}

export function buildLeadDeliveryJobs(page = {}, lead = {}) {
  const integrations = page.integrations || {};
  const jobs = [];
  const email = integrations.email || {};
  const payload = leadIntegrationPayload(lead, page);

  if (email.enabled && isValidEmailAddress(email.to) && shouldSendEmailForLead(email, lead)) {
    jobs.push({
      type: 'email',
      provider: 'ses',
      label: '\uC774\uBA54\uC77C \uC54C\uB9BC',
      to: email.to,
      subject: `[${page.title || '\uD398\uC774\uC9C0\uB85C'}] \uC0C8 \uC811\uC218\uAC00 \uB4E4\uC5B4\uC654\uC2B5\uB2C8\uB2E4`,
      text: leadEmailText(lead, page),
      html: leadEmailHtml(lead, page),
    });
  }

  if (integrations.webhook?.enabled && isValidHttpUrl(integrations.webhook.url)) {
    jobs.push({
      type: 'webhook',
      provider: 'webhook',
      label: 'Webhook',
      url: integrations.webhook.url,
      secret: integrations.webhook.secret || '',
      payload: { ...payload, target: 'webhook', service: integrations.webhook.service || 'custom' },
    });
  }

  if (integrations.automation?.enabled && isValidHttpUrl(integrations.automation.url)) {
    jobs.push({
      type: 'webhook',
      provider: 'automation',
      label: `Automation - ${integrations.automation.service || 'make'}`,
      url: integrations.automation.url,
      secret: integrations.automation.secret || '',
      payload: { ...payload, target: 'automation', service: integrations.automation.service || 'make' },
    });
  }

  if (integrations.sheets?.enabled && String(integrations.sheets.mode || '').toLowerCase() === 'oauth') {
    jobs.push({
      type: 'google_sheets_oauth',
      provider: 'google_sheets',
      label: 'Google Sheets',
      projectId: page.projectId || page.id || '',
      spreadsheetId: integrations.sheets.spreadsheetId || '',
      sheetName: integrations.sheets.sheetName || '접수함',
      payload: googleSheetsPayload(payload, integrations.sheets, page, lead),
    });
  } else if (integrations.sheets?.enabled && isValidHttpUrl(integrations.sheets.webhookUrl || integrations.sheets.url)) {
    jobs.push({
      type: 'webhook',
      provider: 'google_sheets',
      label: 'Google Sheets',
      url: integrations.sheets.webhookUrl || integrations.sheets.url,
      secret: integrations.sheets.secret || '',
      payload: googleSheetsPayload(payload, integrations.sheets, page, lead),
    });
  }

  return jobs.map((job) => ({
    ...job,
    idempotencyKey: deliveryIdempotencyKey(lead, job),
  }));
}

function googleSheetsPayload(payload = {}, sheets = {}, page = {}, lead = {}) {
  const fields = leadAnswerFields(lead);
  const source = {
    utmSource: lead.utmSource || lead.source?.utmSource || lead.attribution?.utmSource || '',
    utmMedium: lead.utmMedium || lead.source?.utmMedium || lead.attribution?.utmMedium || '',
    utmCampaign: lead.utmCampaign || lead.source?.utmCampaign || lead.attribution?.utmCampaign || '',
    referrer: lead.referrer || lead.source?.referrer || lead.attribution?.referrer || '',
    sourceUrl: lead.sourceUrl || lead.source?.sourceUrl || lead.attribution?.sourceUrl || '',
  };
  return {
    schemaVersion: payload.schemaVersion || 'pagero.lead.v1',
    event: payload.event || 'lead.created',
    service: payload.source || 'pagero',
    target: 'google_sheets',
    provider: 'google_sheets',
    mode: sheets.mode || 'webhook',
    spreadsheetId: sheets.spreadsheetId || '',
    sheetName: sheets.sheetName || '\uC811\uC218\uD568',
    connectedEmail: sheets.connectedEmail || '',
    lead: {
      id: lead.id || '',
      name: lead.name || lead.values?.name || '',
      phone: lead.phone || lead.values?.phone || '',
      email: lead.email || lead.values?.email || '',
      message: lead.message || '',
      createdAt: lead.createdAt || payload.createdAt || new Date().toISOString(),
      fields,
    },
    page: {
      id: page.id || page.projectId || '',
      title: page.title || '',
      slug: page.slug || '',
      url: page.publicUrl || page.url || '',
    },
    project: {
      id: page.projectId || page.id || '',
    },
    source,
    attribution: source,
    integration: {
      provider: 'google_sheets',
      mode: sheets.mode || 'webhook',
      spreadsheetId: sheets.spreadsheetId || '',
      connectedEmail: sheets.connectedEmail || '',
      status: sheets.status || '',
    },
    createdAt: lead.createdAt || payload.createdAt || new Date().toISOString(),
  };
}

function leadAnswerFields(lead = {}) {
  const fields = {};
  const reservedKeys = new Set(['name', 'phone', 'email', 'message']);
  const reservedLabels = new Set(['\uC774\uB984', '\uC131\uD568', '\uC5F0\uB77D\uCC98', '\uC804\uD654\uBC88\uD638', '\uD734\uB300\uD3F0\uBC88\uD638', '\uD578\uB4DC\uD3F0\uBC88\uD638', '\uC774\uBA54\uC77C', '\uBA54\uC77C', '\uBB38\uC758\uB0B4\uC6A9', '\uBB38\uC758 \uB0B4\uC6A9', '\uBA54\uC2DC\uC9C0', '\uB0B4\uC6A9']);

  for (const [rawKey, rawValue] of Object.entries(lead.values || {})) {
    const key = String(rawKey || '').trim();
    if (!key || reservedKeys.has(key.toLowerCase()) || reservedLabels.has(key)) continue;
    fields[key] = normalizeSheetFieldValue(rawValue);
  }

  for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
    const key = String(answer?.label || answer?.name || answer?.id || '').trim();
    const type = String(answer?.type || '').trim().toLowerCase();
    if (!key || reservedKeys.has(key.toLowerCase()) || reservedLabels.has(key) || reservedKeys.has(type)) continue;
    fields[key] = normalizeSheetFieldValue(answer?.value ?? answer?.text ?? '');
  }

  return fields;
}

function normalizeSheetFieldValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function leadIntegrationPayload(lead = {}, page = {}) {
  const createdAt = lead.createdAt || new Date().toISOString();
  return {
    brand: '\uD398\uC774\uC9C0\uB85C',
    schemaVersion: 'pagero.lead.v1',
    event: 'lead.created',
    source: 'pagero',
    page: {
      title: page.title || '',
      slug: page.slug || '',
      url: page.publicUrl || page.url || '',
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

export async function sendLeadDelivery(lead = {}, page = {}, env = {}, options = {}) {
  let jobs = buildLeadDeliveryJobs(page, lead);
  const retryProviders = new Set((options.providers || []).map((provider) => String(provider || '').trim()).filter(Boolean));
  if (retryProviders.size) {
    jobs = jobs.filter((job) => retryProviders.has(String(job.provider || '').trim()));
  }
  if (!jobs.length) return deliveryReport();

  const settled = await Promise.allSettled(jobs.map(async (job) => {
    const result = await runDeliveryJob(job, env);
    return {
      target: job.label,
      provider: job.provider || (job.type === 'email' ? 'ses' : 'webhook'),
      status: result.ok ? 'success' : 'failed',
      message: result.message || (result.ok ? '\uC804\uC1A1 \uC644\uB8CC' : '\uC804\uC1A1 \uC2E4\uD328'),
      idempotencyKey: job.idempotencyKey || '',
      at: new Date().toISOString(),
    };
  }));

  const logs = settled.map((item, index) => {
    const job = jobs[index] || {};
    if (item.status === 'fulfilled') return item.value;
    return {
      target: job.label || '\uC54C\uB9BC \uC804\uC1A1',
      provider: job.provider || (job.type === 'email' ? 'ses' : 'webhook'),
      status: 'failed',
      message: safeDeliveryErrorMessage(item.reason),
      idempotencyKey: job.idempotencyKey || '',
      at: new Date().toISOString(),
    };
  });

  return summarizeDelivery(logs);
}

export function failedDeliveryProviders(delivery = {}) {
  return Array.from(new Set((delivery.logs || [])
    .filter((log) => log?.status === 'failed')
    .map((log) => String(log.provider || '').trim())
    .filter(Boolean)));
}

export function mergeDeliveryReports(previous = {}, retry = {}) {
  const retriedProviders = new Set((retry.logs || []).map((log) => String(log.provider || '').trim()).filter(Boolean));
  const keptLogs = (previous.logs || []).filter((log) => !retriedProviders.has(String(log.provider || '').trim()));
  return summarizeDelivery([...keptLogs, ...(retry.logs || [])]);
}

async function runDeliveryJob(job = {}, env = {}) {
  if (job.type === 'email') {
    const result = await sendSesEmail({
      to: job.to,
      subject: job.subject,
      text: job.text,
      html: job.html,
    }, env);
    return { ok: true, message: result.messageId ? `\uC804\uC1A1 \uC644\uB8CC ${result.messageId}` : '\uC804\uC1A1 \uC644\uB8CC' };
  }

  if (job.type === 'google_sheets_oauth') {
    return sendGoogleSheetsOAuthJob(job, env);
  }

  const res = await fetch(job.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Pagero-Idempotency-Key': job.idempotencyKey || '',
      ...(job.secret ? { 'X-Pagero-Secret': job.secret } : {}),
    },
    body: JSON.stringify({ ...(job.payload || {}), idempotencyKey: job.idempotencyKey || '' }),
    signal: AbortSignal.timeout(10000),
  });

  return { ok: res.ok, message: res.ok ? '\uC804\uC1A1 \uC644\uB8CC' : `\uC751\uB2F5 \uD655\uC778 \uD544\uC694 ${res.status}` };
}

async function sendGoogleSheetsOAuthJob(job = {}, env = {}) {
  const projectId = String(job.projectId || job.payload?.project?.id || '').trim();
  if (!env.DB?.prepare || !projectId) return { ok: false, message: 'Google Sheets 연결 필요' };

  const integration = await getGoogleSheetsIntegration(env.DB, projectId);
  if (!integration || integration.status !== 'connected') {
    return { ok: false, message: 'Google Sheets 연결 필요' };
  }

  const settings = integration.settings || {};
  let tokens = integration.tokens || {};
  const spreadsheetId = String(job.spreadsheetId || settings.spreadsheetId || integration.externalId || '').trim();
  const sheetName = String(job.sheetName || settings.sheetName || '접수함').trim() || '접수함';
  let accessToken = String(tokens.accessToken || '').trim();

  try {
    if (!accessToken && tokens.refreshToken) {
      tokens = mergeGoogleTokens(tokens, await refreshGoogleAccessToken({
        refreshToken: tokens.refreshToken,
        clientId: googleClientId(env),
        clientSecret: googleClientSecret(env),
      }));
      accessToken = tokens.accessToken || '';
      await updateGoogleSheetsIntegrationStatus(env.DB, projectId, { tokens });
    }

    const row = googleSheetsPayloadRow(job.payload || {});
    try {
      await appendGoogleSheetRow({ accessToken, spreadsheetId, sheetName, row });
    } catch (error) {
      if (error?.status !== 401 || !tokens.refreshToken) throw error;
      tokens = mergeGoogleTokens(tokens, await refreshGoogleAccessToken({
        refreshToken: tokens.refreshToken,
        clientId: googleClientId(env),
        clientSecret: googleClientSecret(env),
      }));
      accessToken = tokens.accessToken || '';
      await appendGoogleSheetRow({ accessToken, spreadsheetId, sheetName, row });
      await updateGoogleSheetsIntegrationStatus(env.DB, projectId, { tokens });
    }

    await updateGoogleSheetsIntegrationStatus(env.DB, projectId, {
      status: 'connected',
      lastSyncAt: new Date().toISOString(),
      lastError: '',
      settings: { ...settings, spreadsheetId, sheetName },
      tokens,
    });
    return { ok: true, message: 'Google Sheets 전송 완료' };
  } catch (error) {
    const message = safeGoogleSheetsMessage(error);
    await updateGoogleSheetsIntegrationStatus(env.DB, projectId, {
      status: 'error',
      lastError: message,
    });
    return { ok: false, message };
  }
}

function safeGoogleSheetsMessage(error) {
  const status = Number(error?.status || 0);
  if (status === 401) return 'Google Sheets 인증 만료';
  if (status === 403) return 'Google Sheets 권한 없음';
  if (status === 404) return 'Google Sheets 파일 없음';
  if (status === 400) return 'Google Sheets 설정 필요';
  return 'Google Sheets 전송 실패';
}

export function summarizeDelivery(logs = []) {
  const success = logs.filter((log) => log.status === 'success').length;
  const failed = logs.filter((log) => log.status === 'failed').length;
  if (success && !failed) return deliveryReport('success', `${success}\uAC1C \uC54C\uB9BC \uC804\uC1A1 \uC644\uB8CC`, logs);
  if (success && failed) return deliveryReport('partial', `${success}\uAC1C \uC131\uACF5, ${failed}\uAC1C \uC2E4\uD328`, logs);
  return deliveryReport('failed', `${failed || logs.length}\uAC1C \uC54C\uB9BC \uC804\uC1A1 \uC2E4\uD328`, logs);
}

function shouldSendEmailForLead(email = {}, lead = {}) {
  const inputType = Object.prototype.hasOwnProperty.call(lead, 'rawType')
    ? lead.rawType
    : lead.type || lead.kind || lead.category || '';
  const type = String(inputType || '').trim();
  const consultEnabled = email.consult !== false;
  const reservationEnabled = email.reservation !== false;
  if (/\uC608\uC57D|\uBC29\uBB38|reservation|booking|reserve/i.test(type)) return reservationEnabled;
  if (!type || /unknown|custom|lead|submit|form/i.test(type)) return consultEnabled || reservationEnabled;
  return consultEnabled;
}

function leadEmailText(lead = {}, page = {}) {
  const answers = Array.isArray(lead.answers) ? lead.answers : [];
  const answerLines = answers.map((answer) => {
    const value = Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '-');
    return `- ${answer.label || answer.id || '\uD56D\uBAA9'}: ${value}`;
  });

  return [
    `${page.title || page.slug || '\uD398\uC774\uC9C0'}\uC5D0 \uC0C8 \uC811\uC218\uAC00 \uB4E4\uC5B4\uC654\uC2B5\uB2C8\uB2E4.`,
    '',
    `\uC811\uC218 \uC720\uD615: ${lead.type || lead.kind || '-'}`,
    `\uC811\uC218 \uC2DC\uAC04: ${formatKoreanDateTime(lead.createdAt || lead.submittedAt)}`,
    `\uC774\uB984: ${lead.name || '-'}`,
    `\uC5F0\uB77D\uCC98: ${lead.phone || '-'}`,
    `\uC774\uBA54\uC77C: ${lead.email || '-'}`,
    `\uC8FC\uC18C: ${lead.address || '-'}`,
    `\uBB38\uC758 \uB0B4\uC6A9: ${lead.message || '-'}`,
    '',
    '[\uC785\uB825 \uB0B4\uC6A9]',
    ...(answerLines.length ? answerLines : ['- \uCD94\uAC00 \uC785\uB825 \uC5C6\uC74C']),
    '',
    '\uBCF8 \uBA54\uC77C\uC740 \uD398\uC774\uC9C0\uB85C \uC811\uC218 \uC54C\uB9BC \uC124\uC815\uC5D0 \uB530\uB77C \uBC1C\uC1A1\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
    `\uBCF8\uC778\uC774 \uC694\uCCAD\uD558\uC9C0 \uC54A\uC558\uB2E4\uBA74 \uACE0\uAC1D\uC13C\uD130\uB85C \uBB38\uC758\uD574\uC8FC\uC138\uC694. \uACE0\uAC1D\uC13C\uD130: ${SUPPORT_EMAIL}`,
  ].join('\n');
}

function leadEmailHtml(lead = {}, page = {}) {
  const rows = [
    ['\uC811\uC218 \uC720\uD615', lead.type || lead.kind || '-'],
    ['\uC811\uC218 \uC2DC\uAC04', formatKoreanDateTime(lead.createdAt || lead.submittedAt)],
    ['\uC774\uB984', lead.name || '-'],
    ['\uC5F0\uB77D\uCC98', lead.phone || '-'],
    ['\uC774\uBA54\uC77C', lead.email || '-'],
    ['\uC8FC\uC18C', lead.address || '-'],
    ['\uBB38\uC758 \uB0B4\uC6A9', lead.message || '-'],
  ];
  const answers = Array.isArray(lead.answers) ? lead.answers : [];
  const answerRows = answers.length
    ? answers.map((answer) => [answer.label || answer.id || '\uD56D\uBAA9', Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '-')])
    : [['\uCD94\uAC00 \uC785\uB825', '\uC5C6\uC74C']];
  const renderRows = (items) => items.map(([label, value]) => `
    <tr>
      <th style="width:116px;padding:12px 14px;background:#f8fafc;border-bottom:1px solid #e5edf6;color:#64748b;font-size:13px;text-align:left;vertical-align:top;">${escapeHtml(label)}</th>
      <td style="padding:12px 14px;border-bottom:1px solid #e5edf6;color:#111827;font-size:14px;line-height:1.55;word-break:break-word;">${escapeHtml(value)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="ko">
<body style="margin:0;background:#f3f6fb;padding:28px 16px;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#111827;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #dbe4f0;border-radius:24px;overflow:hidden;box-shadow:0 16px 44px rgba(15,23,42,.10);">
    <div style="padding:24px 26px;background:#0f172a;color:#fff;">
      <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#2563eb;color:#fff;font-size:13px;font-weight:900;letter-spacing:.02em;">\uD398\uC774\uC9C0\uB85C</div>
      <h1 style="margin:16px 0 0;font-size:24px;line-height:1.25;">\uC0C8 \uC811\uC218\uAC00 \uB4E4\uC5B4\uC654\uC2B5\uB2C8\uB2E4</h1>
      <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;line-height:1.5;">${escapeHtml(page.title || page.slug || '\uB79C\uB529\uD398\uC774\uC9C0')}</p>
    </div>
    <div style="padding:24px 26px;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5edf6;border-radius:16px;overflow:hidden;">${renderRows(rows)}</table>
      <h2 style="margin:22px 0 10px;font-size:16px;">\uC785\uB825 \uB0B4\uC6A9</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5edf6;border-radius:16px;overflow:hidden;">${renderRows(answerRows)}</table>
      <p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.7;">\uBCF8 \uBA54\uC77C\uC740 \uD398\uC774\uC9C0\uB85C \uC811\uC218 \uC54C\uB9BC \uC124\uC815\uC5D0 \uB530\uB77C \uBC1C\uC1A1\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uBCF8\uC778\uC774 \uC694\uCCAD\uD558\uC9C0 \uC54A\uC558\uB2E4\uBA74 <a href="mailto:${SUPPORT_EMAIL}" style="color:#2563eb;text-decoration:none;">${SUPPORT_EMAIL}</a>\uB85C \uBB38\uC758\uD574\uC8FC\uC138\uC694.</p>
    </div>
  </div>
</body>
</html>`;
}

function deliveryIdempotencyKey(lead = {}, job = {}) {
  return [lead.id, lead.updatedAt || lead.createdAt || lead.submittedAt, job.type, job.label]
    .map((value) => String(value || '').replace(/[^a-zA-Z0-9_.:-]/g, '-'))
    .filter(Boolean)
    .join(':')
    .slice(0, 180);
}

function isValidHttpUrl(value = '') {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function safeDeliveryErrorMessage(error) {
  const code = String(error?.code || '').trim();
  if (code === 'EMAIL_SEND_NOT_CONFIGURED') return '메일 발송 설정을 확인해주세요.';
  if (code === 'EMAIL_SEND_KEY_MISSING') return '메일 발송 설정을 확인해주세요.';
  if (code === 'EMAIL_TO_INVALID') return '받을 이메일 주소 형식이 올바르지 않습니다.';
  if (code === 'EMAIL_SEND_TIMEOUT') return '메일 발송 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
  if (code === 'EMAIL_SEND_SANDBOX_REJECTED') return '메일 발송 권한을 확인해주세요.';
  if (code === 'EMAIL_RECIPIENT_NOT_VERIFIED') return '받을 이메일 주소를 확인해주세요.';
  if (code === 'EMAIL_DOMAIN_NOT_VERIFIED') return '발신 이메일 설정을 확인해주세요.';
  if (code === 'EMAIL_SEND_QUOTA_EXCEEDED') return '메일 발송량이 일시적으로 많습니다. 잠시 후 다시 시도해주세요.';
  if (code.startsWith('EMAIL_')) return '메일 발송에 실패했습니다. 설정을 확인해주세요.';
  return '전송 실패';
}

function formatKoreanDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(date);
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
