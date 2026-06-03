import { isValidEmailAddress, sendSesEmail } from '../_ses.js';

const SUPPORT_EMAIL = 'support@pagero.kr';
export const NO_DELIVERY_SETTINGS_MESSAGE = '전송 설정 없음';

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
      label: '이메일 알림',
      to: email.to,
      subject: `[${page.title || '페이지로'}] 새 접수가 들어왔습니다`,
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

  if (integrations.sheets?.enabled && isValidHttpUrl(integrations.sheets.webhookUrl || integrations.sheets.url)) {
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
    sheetName: sheets.sheetName || '접수함',
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
  const reservedLabels = new Set(['이름', '성함', '연락처', '전화번호', '핸드폰번호', '휴대폰번호', '이메일', '메일', '문의내용', '문의 내용', '메시지', '내용']);

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
    brand: '페이지로',
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

export async function sendLeadDelivery(lead = {}, page = {}, env = {}) {
  const jobs = buildLeadDeliveryJobs(page, lead);
  if (!jobs.length) return deliveryReport();

  const settled = await Promise.allSettled(jobs.map(async (job) => {
    const result = await runDeliveryJob(job, env);
    return {
      target: job.label,
      provider: job.provider || (job.type === 'email' ? 'ses' : 'webhook'),
      status: result.ok ? 'success' : 'failed',
      message: result.message || (result.ok ? '전송 완료' : '전송 실패'),
      idempotencyKey: job.idempotencyKey || '',
      at: new Date().toISOString(),
    };
  }));

  const logs = settled.map((item, index) => {
    const job = jobs[index] || {};
    if (item.status === 'fulfilled') return item.value;
    return {
      target: job.label || '알림 전송',
      provider: job.provider || (job.type === 'email' ? 'ses' : 'webhook'),
      status: 'failed',
      message: safeDeliveryErrorMessage(item.reason),
      idempotencyKey: job.idempotencyKey || '',
      at: new Date().toISOString(),
    };
  });

  return summarizeDelivery(logs);
}

async function runDeliveryJob(job = {}, env = {}) {
  if (job.type === 'email') {
    const result = await sendSesEmail({
      to: job.to,
      subject: job.subject,
      text: job.text,
      html: job.html,
    }, env);
    return { ok: true, message: result.messageId ? `전송 완료 ${result.messageId}` : '전송 완료' };
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

  return { ok: res.ok, message: res.ok ? '전송 완료' : `응답 확인 필요 ${res.status}` };
}

function summarizeDelivery(logs = []) {
  const success = logs.filter((log) => log.status === 'success').length;
  const failed = logs.filter((log) => log.status === 'failed').length;
  if (success && !failed) return deliveryReport('success', `${success}개 알림 전송 완료`, logs);
  if (success && failed) return deliveryReport('partial', `${success}개 성공, ${failed}개 실패`, logs);
  return deliveryReport('failed', `${failed || logs.length}개 알림 전송 실패`, logs);
}

function shouldSendEmailForLead(email = {}, lead = {}) {
  const type = String(lead.type || lead.kind || '');
  if (/예약|방문|reservation|booking|reserve/i.test(type)) return email.reservation !== false;
  return email.consult !== false;
}

function leadEmailText(lead = {}, page = {}) {
  const answers = Array.isArray(lead.answers) ? lead.answers : [];
  const answerLines = answers.map((answer) => {
    const value = Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '-');
    return `- ${answer.label || answer.id || '항목'}: ${value}`;
  });

  return [
    `${page.title || page.slug || '페이지'}에 새 접수가 들어왔습니다.`,
    '',
    `접수 유형: ${lead.type || lead.kind || '-'}`,
    `접수 시간: ${formatKoreanDateTime(lead.createdAt || lead.submittedAt)}`,
    `이름: ${lead.name || '-'}`,
    `연락처: ${lead.phone || '-'}`,
    `이메일: ${lead.email || '-'}`,
    `주소: ${lead.address || '-'}`,
    `문의 내용: ${lead.message || '-'}`,
    '',
    '[입력 내용]',
    ...(answerLines.length ? answerLines : ['- 추가 입력 없음']),
    '',
    '이 메일은 페이지로 접수 알림 설정에 따라 발송되었습니다.',
    `본인이 요청하지 않았다면 고객센터로 문의해주세요. 고객센터: ${SUPPORT_EMAIL}`,
  ].join('\n');
}

function leadEmailHtml(lead = {}, page = {}) {
  const rows = [
    ['접수 유형', lead.type || lead.kind || '-'],
    ['접수 시간', formatKoreanDateTime(lead.createdAt || lead.submittedAt)],
    ['이름', lead.name || '-'],
    ['연락처', lead.phone || '-'],
    ['이메일', lead.email || '-'],
    ['주소', lead.address || '-'],
    ['문의 내용', lead.message || '-'],
  ];
  const answers = Array.isArray(lead.answers) ? lead.answers : [];
  const answerRows = answers.length
    ? answers.map((answer) => [answer.label || answer.id || '항목', Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '-')])
    : [['추가 입력', '없음']];
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
      <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#2563eb;color:#fff;font-size:13px;font-weight:900;letter-spacing:.02em;">페이지로</div>
      <h1 style="margin:16px 0 0;font-size:24px;line-height:1.25;">새 접수가 들어왔습니다</h1>
      <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;line-height:1.5;">${escapeHtml(page.title || page.slug || '랜딩페이지')}</p>
    </div>
    <div style="padding:24px 26px;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5edf6;border-radius:16px;overflow:hidden;">${renderRows(rows)}</table>
      <h2 style="margin:22px 0 10px;font-size:16px;">입력 내용</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5edf6;border-radius:16px;overflow:hidden;">${renderRows(answerRows)}</table>
      <p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.7;">이 메일은 페이지로 접수 알림 설정에 따라 발송되었습니다. 본인이 요청하지 않았다면 <a href="mailto:${SUPPORT_EMAIL}" style="color:#2563eb;text-decoration:none;">${SUPPORT_EMAIL}</a>로 문의해주세요.</p>
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
