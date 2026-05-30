import { isValidEmailAddress, sendSesEmail } from '../_ses.js';

export function deliveryReport(status = 'none', summary = '알림 전송 설정 없음', logs = []) {
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
  if (email.enabled && isValidEmailAddress(email.to) && shouldSendEmailForLead(email, lead)) {
    jobs.push({
      type: 'email',
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
      label: 'Webhook',
      url: integrations.webhook.url,
      secret: integrations.webhook.secret || '',
      payload: {
        brand: '페이지로',
        target: 'webhook',
        service: integrations.webhook.service || 'custom',
        page: { title: page.title || '', slug: page.slug || '' },
        lead,
        createdAt: lead.createdAt || new Date().toISOString(),
      },
    });
  }
  return jobs.map((job) => ({
    ...job,
    idempotencyKey: deliveryIdempotencyKey(lead, job),
  }));
}

export async function sendLeadDelivery(lead = {}, page = {}, env = {}) {
  const jobs = buildLeadDeliveryJobs(page, lead);
  if (!jobs.length) return deliveryReport();
  const settled = await Promise.allSettled(jobs.map(async (job) => {
    const result = await runDeliveryJob(job, env);
    return {
      target: job.label,
      provider: job.type === 'email' ? 'ses' : 'webhook',
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
      provider: job.type === 'email' ? 'ses' : 'webhook',
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
  if (/예약|reservation|booking|reserve/i.test(type)) return email.reservation !== false;
  return email.consult !== false;
}

function leadEmailText(lead = {}, page = {}) {
  const answers = Array.isArray(lead.answers) ? lead.answers : [];
  const answerLines = answers.map((answer) => {
    const value = Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '-');
    return `- ${answer.label || answer.id || '항목'}: ${value}`;
  });
  return [
    `${page.title || page.slug || '페이지로'}에 새 접수가 들어왔습니다.`,
    '',
    `접수 유형: ${lead.type || lead.kind || '-'}`,
    `접수 시간: ${lead.createdAt || lead.submittedAt || '-'}`,
    `이름: ${lead.name || '-'}`,
    `연락처: ${lead.phone || '-'}`,
    `이메일: ${lead.email || '-'}`,
    `주소: ${lead.address || '-'}`,
    `문의 내용: ${lead.message || '-'}`,
    '',
    '[입력 내용]',
    ...(answerLines.length ? answerLines : ['- 추가 입력 없음']),
  ].join('\n');
}

function leadEmailHtml(lead = {}, page = {}) {
  const rows = leadEmailText(lead, page).split('\n').map(escapeHtml).join('<br>');
  return `<!doctype html><html lang="ko"><body style="margin:0;background:#f3f6fb;padding:28px 16px;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#111827;"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dbe4f0;border-radius:22px;overflow:hidden;box-shadow:0 16px 44px rgba(15,23,42,.10);"><div style="padding:24px 26px;background:#111827;color:#fff;"><strong style="font-size:20px;">페이지로</strong><p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">새 접수 알림</p></div><div style="padding:26px;font-size:15px;line-height:1.7;">${rows}</div></div></body></html>`;
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

function safeDeliveryErrorMessage(error) {
  const code = String(error?.code || '').trim();
  if (code === 'EMAIL_SEND_NOT_CONFIGURED') return '메일 전송 설정이 필요합니다.';
  if (code === 'EMAIL_TO_INVALID') return '받을 이메일 주소를 확인해주세요.';
  if (code === 'EMAIL_SEND_TIMEOUT') return '메일 전송 시간이 초과되었습니다.';
  if (code === 'EMAIL_SEND_SANDBOX_REJECTED') return '현재 SES 샌드박스 상태라 수신자 제한이 있습니다.';
  if (code === 'EMAIL_DOMAIN_NOT_VERIFIED') return '발신 도메인 인증을 확인해주세요.';
  if (code === 'EMAIL_SEND_QUOTA_EXCEEDED') return '메일 전송 한도를 초과했습니다.';
  return String(error?.providerMessage || error?.message || error || '전송 실패');
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
