export async function notifyPayoutRequestAdmin(env = {}, payout = {}) {
  const recipients = adminRecipients(env);
  if (!recipients.length) return { ok: true, skipped: true, reason: 'PARTNER_PAYOUT_ADMIN_EMAIL_NOT_CONFIGURED' };

  const config = sesConfig(env);
  if (!config.ok) return { ok: false, skipped: true, reason: 'SES_NOT_CONFIGURED' };

  const amount = positiveInt(payout.amountKrw);
  const requestId = safeText(payout.requestId, 120);
  const ownerId = safeText(payout.ownerId, 120);
  const service = serviceLabel(payout.service);
  const month = safeText(payout.month, 7);
  const requestedAt = safeText(payout.requestedAt, 40);
  const adminUrl = String(env.CALLTAG_ADMIN_URL || 'https://calltag.pagero.kr/admin').trim();
  const subject = `[콜태그] 새 정산 지급요청 ${formatKrw(amount)}원`;
  const text = [
    '새 파트너 정산 지급요청이 접수되었습니다.',
    '',
    `요청금액: ${formatKrw(amount)}원`,
    `서비스: ${service}`,
    month ? `정산월: ${month}` : '',
    requestedAt ? `요청일시: ${requestedAt}` : '',
    `파트너: ${ownerId || '-'}`,
    `요청번호: ${requestId || '-'}`,
    '',
    `관리자 확인: ${adminUrl}`,
    '',
    '실제 계좌 송금 확인 후 관리자 페이지에서 지급완료 처리하세요.',
  ].filter(Boolean).join('\n');
  const html = `<!doctype html><html lang="ko"><body style="margin:0;background:#f4f6f8;padding:28px 16px;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#111827"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden"><div style="padding:26px 28px 16px"><div style="font-size:12px;font-weight:900;color:#4f46e5">콜태그 × 페이지로 정산</div><h1 style="margin:8px 0 0;font-size:22px">새 지급요청이 접수되었습니다</h1></div><div style="margin:0 28px 22px;padding:18px;border-radius:14px;background:#f8fafc"><div style="font-size:12px;color:#6b7280">요청금액</div><div style="margin-top:4px;font-size:28px;font-weight:950">${escapeHtml(formatKrw(amount))}원</div><div style="margin-top:14px;font-size:13px;line-height:1.8;color:#374151">서비스: <b>${escapeHtml(service)}</b><br>${month ? `정산월: <b>${escapeHtml(month)}</b><br>` : ''}${requestedAt ? `요청일시: <b>${escapeHtml(requestedAt)}</b><br>` : ''}파트너: <b>${escapeHtml(ownerId || '-')}</b><br>요청번호: <b>${escapeHtml(requestId || '-')}</b></div></div><div style="padding:0 28px 28px"><a href="${escapeHtml(adminUrl)}" style="display:block;padding:13px 16px;border-radius:10px;background:#111827;color:#fff;text-align:center;text-decoration:none;font-weight:900">관리자에서 확인</a><p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#6b7280">실제 계좌 송금 확인 후 관리자 페이지에서 지급완료 처리하세요.</p></div></div></body></html>`;

  return sendSes(env, config, recipients, subject, text, html);
}

async function sendSes(env, config, recipients, subject, text, html) {
  const body = JSON.stringify({
    FromEmailAddress: config.from,
    Destination: { ToAddresses: recipients },
    Content: { Simple: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Text: { Data: text, Charset: 'UTF-8' },
        Html: { Data: html, Charset: 'UTF-8' },
      },
    } },
  });
  const host = `email.${config.region}.amazonaws.com`;
  const path = '/v2/email/outbound-emails';
  const amzDate = awsAmzDate(new Date());
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/ses/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256Hex(canonicalRequest)].join('\n');
  const signingKey = await awsSigningKey(config.secretAccessKey, dateStamp, config.region, 'ses');
  const signature = bytesToHex(await hmacBytesRaw(signingKey, stringToSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Amz-Date': amzDate, Authorization: authorization },
    body,
  });
  const responseText = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`PARTNER_PAYOUT_ADMIN_EMAIL_FAILED:${response.status}:${responseText.slice(0, 160)}`);
  let data = {};
  try { data = responseText ? JSON.parse(responseText) : {}; } catch {}
  return { ok: true, skipped: false, messageId: String(data.MessageId || data.messageId || '') };
}

function adminRecipients(env = {}) {
  return String(env.PARTNER_PAYOUT_ADMIN_EMAIL || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, list) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && list.indexOf(value) === index)
    .slice(0, 5);
}

function sesConfig(env = {}) {
  const region = first(env, ['AWS_SES_REGION', 'INLET_AWS_SES_REGION', 'AWS_REGION'], 'ap-northeast-2').toLowerCase();
  const accessKeyId = first(env, ['AWS_SES_ACCESS_KEY_ID', 'INLET_AWS_SES_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'SES_ACCESS_KEY_ID', 'Access key ID']);
  const secretAccessKey = first(env, ['AWS_SES_SECRET_ACCESS_KEY', 'INLET_AWS_SES_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'SES_SECRET_ACCESS_KEY', 'Secret access key']);
  const from = normalizeFrom(first(env, ['INLET_AUTH_EMAIL_FROM', 'INLET_LEAD_EMAIL_FROM', 'AWS_SES_FROM'], '페이지로 <support@pagero.kr>'));
  return { ok: /^(?:af|ap|ca|eu|il|me|mx|sa|us)-(?:central|east|north|northeast|northwest|south|southeast|southwest|west)-\d$/.test(region) && !!accessKeyId && !!secretAccessKey && !!from, region, accessKeyId, secretAccessKey, from };
}

function first(env, keys, fallback = '') { for (const key of keys) { const value = String(env[key] || '').trim(); if (value) return value; } return fallback; }
function normalizeFrom(value = '') { const from = String(value || '').trim(); const match = from.match(/^(.+?)<([^<>]+)>$/); if (!match) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) ? from : ''; const email = match[2].trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ''; const display = match[1].trim().replace(/^["']|["']$/g, ''); return display && /^[\x20-\x7E]+$/.test(display) ? `${display} <${email}>` : email; }
function safeText(value, max) { return String(value || '').replace(/[\r\n<>]/g, '').slice(0, max); }
function positiveInt(value) { const n = Number(value || 0); return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0; }
function formatKrw(value) { return positiveInt(value).toLocaleString('ko-KR'); }
function serviceLabel(value) { const service = String(value || 'ALL').toUpperCase(); return service === 'CALLTAG' ? '콜태그' : service === 'PAGERO' ? '페이지로' : '전체'; }
function escapeHtml(value = '') { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function awsAmzDate(date) { return date.toISOString().replace(/[:-]|\.\d{3}/g, ''); }
async function sha256Hex(value = '') { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return bytesToHex(new Uint8Array(digest)); }
async function awsSigningKey(secret, dateStamp, region, service) { const dateKey = await hmacBytesRaw(new TextEncoder().encode(`AWS4${secret}`), dateStamp); const regionKey = await hmacBytesRaw(dateKey, region); const serviceKey = await hmacBytesRaw(regionKey, service); return hmacBytesRaw(serviceKey, 'aws4_request'); }
async function hmacBytesRaw(keyBytes, value = '') { const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)); return new Uint8Array(signature); }
function bytesToHex(bytes) { return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
