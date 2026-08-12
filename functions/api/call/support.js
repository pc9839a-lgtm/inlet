import { handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { CALL_METHODS, callError, callSession, normalizeText } from './_shared.js';

const SUPPORT_TO = 'roadfor@kakao.com';
const MAX_MESSAGE = 5000;

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALL_METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, CALL_METHODS);
  }

  try {
    const input = await readJson(request);
    const session = await callSession(request, env, input);
    const type = normalizeType(input.type);
    const name = normalizeText(input.name || session.profile?.name || '', 80);
    const contact = normalizeText(input.contact || session.profile?.phone || '', 80);
    const email = normalizeEmail(input.email || session.profile?.email || '');
    const message = String(input.message || '').trim().slice(0, MAX_MESSAGE);
    const appVersion = normalizeText(input.appVersion, 40);

    if (!name) throw callError('이름을 입력해주세요.', 400, { code: 'SUPPORT_NAME_REQUIRED' });
    if (!isValidEmail(email)) {
      throw callError('답변 받을 이메일을 확인해주세요.', 400, { code: 'SUPPORT_EMAIL_INVALID' });
    }
    if (message.length < 5) {
      throw callError('문의 내용을 조금 더 입력해주세요.', 400, { code: 'SUPPORT_MESSAGE_REQUIRED' });
    }

    const sent = await sendSupportEmail({
      type,
      name,
      contact,
      email,
      message,
      appVersion,
      ownerId: session.ownerId,
    }, env);

    return jsonResponse(request, env, 200, {
      ok: true,
      submitted: true,
      messageId: sent.messageId,
    }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}

async function sendSupportEmail(inquiry = {}, env = {}) {
  const config = sesConfig(env);
  if (!config.ok) {
    throw callError('고객센터 메일 발송 설정이 필요합니다.', 503, {
      code: 'SUPPORT_EMAIL_NOT_CONFIGURED',
    });
  }

  const to = normalizeEmail(String(env.CALLTAG_SUPPORT_EMAIL || SUPPORT_TO));
  if (!isValidEmail(to)) {
    throw callError('고객센터 수신 메일 설정이 올바르지 않습니다.', 503, {
      code: 'SUPPORT_EMAIL_TO_INVALID',
    });
  }

  const subject = `[콜태그 고객문의] ${inquiry.type} - ${inquiry.name}`;
  const text = [
    '콜태그 앱 고객문의가 접수되었습니다.',
    '',
    `문의 유형: ${inquiry.type}`,
    `이름: ${inquiry.name}`,
    `연락처: ${inquiry.contact || '-'}`,
    `답변 이메일: ${inquiry.email}`,
    `계정 ID: ${inquiry.ownerId || '-'}`,
    `앱 버전: ${inquiry.appVersion || '-'}`,
    '',
    '문의 내용',
    inquiry.message,
  ].join('\n');

  const html = `<!doctype html>
<html lang="ko"><body style="font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#111827;line-height:1.6">
<h2 style="margin:0 0 18px">콜태그 고객문의</h2>
<table style="border-collapse:collapse;width:100%;max-width:680px">
${row('문의 유형', inquiry.type)}
${row('이름', inquiry.name)}
${row('연락처', inquiry.contact || '-')}
${row('답변 이메일', inquiry.email)}
${row('계정 ID', inquiry.ownerId || '-')}
${row('앱 버전', inquiry.appVersion || '-')}
</table>
<div style="margin-top:22px;font-weight:700">문의 내용</div>
<div style="margin-top:8px;padding:16px;border:1px solid #e5e7eb;border-radius:12px;white-space:pre-wrap">${escapeHtml(inquiry.message)}</div>
</body></html>`;

  const body = JSON.stringify({
    FromEmailAddress: config.from,
    Destination: { ToAddresses: [to] },
    ReplyToAddresses: [inquiry.email],
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: text, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    },
  });

  const host = `email.${config.region}.amazonaws.com`;
  const path = '/v2/email/outbound-emails';
  const amzDate = awsAmzDate(new Date());
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);
  const canonicalHeaders = [
    'content-type:application/json',
    `host:${host}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/ses/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = await awsSigningKey(
    config.secretAccessKey, dateStamp, config.region, 'ses');
  const signature = bytesToHex(await hmacBytesRaw(signingKey, stringToSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  let response;
  try {
    response = await fetch(`https://${host}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        Authorization: authorization,
      },
      body,
    });
  } catch (error) {
    console.error('calltag support SES network failure', {
      name: String(error?.name || ''),
    });
    throw callError('고객센터 메일 서버 연결에 실패했습니다.', 502, {
      code: 'SUPPORT_EMAIL_NETWORK_ERROR',
    });
  }

  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
  if (!response.ok) {
    console.error('calltag support SES rejected', { httpStatus: response.status });
    throw callError('문의 메일 발송에 실패했습니다.', 502, {
      code: 'SUPPORT_EMAIL_PROVIDER_ERROR',
      providerStatus: Number(response.status || 0),
    });
  }

  return {
    messageId: String(data.MessageId || data.messageId || ''),
  };
}

function normalizeType(value = '') {
  const type = normalizeText(value, 30);
  return ['일반문의', '결제', '오류', '기타'].includes(type) ? type : '일반문의';
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase().slice(0, 254);
}

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function sesConfig(env = {}) {
  const region = envFirst(env,
    ['AWS_SES_REGION', 'INLET_AWS_SES_REGION', 'AWS_REGION'],
    'ap-northeast-2').toLowerCase();
  const accessKeyId = envFirst(env,
    ['AWS_SES_ACCESS_KEY_ID', 'INLET_AWS_SES_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'SES_ACCESS_KEY_ID', 'Access key ID']);
  const secretAccessKey = envFirst(env,
    ['AWS_SES_SECRET_ACCESS_KEY', 'INLET_AWS_SES_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'SES_SECRET_ACCESS_KEY', 'Secret access key']);
  const from = normalizeSesFromAddress(envFirst(env,
    ['INLET_LEAD_EMAIL_FROM', 'INLET_AUTH_EMAIL_FROM', 'AWS_SES_FROM'],
    '콜태그 <support@pagero.kr>'));
  const regionValid = /^(?:af|ap|ca|eu|il|me|mx|sa|us)-(?:central|east|north|northeast|northwest|south|southeast|southwest|west)-\d$/.test(region);
  return {
    ok: regionValid && !!accessKeyId && !!secretAccessKey && !!from,
    region,
    accessKeyId,
    secretAccessKey,
    from,
  };
}

function envFirst(env = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = String(env[key] || '').trim();
    if (value) return value;
  }
  return fallback;
}

function normalizeSesFromAddress(value = '') {
  const from = String(value || '').trim();
  const match = from.match(/^(.+?)<([^<>]+)>$/);
  if (!match) return isValidEmail(from) ? from : '';
  const displayName = match[1].trim().replace(/^["']|["']$/g, '');
  const email = normalizeEmail(match[2]);
  if (!isValidEmail(email)) return '';
  if (!displayName) return email;
  if (/^[\x20-\x7E]+$/.test(displayName)) return `${displayName} <${email}>`;
  return `${mimeBase64Word(displayName)} <${email}>`;
}

function row(label, value) {
  return `<tr><th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb">${escapeHtml(label)}</th><td style="padding:8px 12px;border:1px solid #e5e7eb">${escapeHtml(value)}</td></tr>`;
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mimeBase64Word(value = '') {
  const bytes = new TextEncoder().encode(String(value || ''));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function awsAmzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

async function sha256Hex(value = '') {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function awsSigningKey(secret, dateStamp, region, service) {
  const dateKey = await hmacBytesRaw(new TextEncoder().encode(`AWS4${secret}`), dateStamp);
  const regionKey = await hmacBytesRaw(dateKey, region);
  const serviceKey = await hmacBytesRaw(regionKey, service);
  return hmacBytesRaw(serviceKey, 'aws4_request');
}

async function hmacBytesRaw(keyBytes, value = '') {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(value));
  return new Uint8Array(signature);
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
