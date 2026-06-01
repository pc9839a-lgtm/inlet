export function normalizeEmailAddress(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function isValidEmailAddress(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function normalizeSesFromAddress(value = '') {
  const from = String(value || '').trim();
  const match = from.match(/^(.+?)<([^<>]+)>$/);
  if (!match) return from;
  const displayName = match[1].trim().replace(/^["']|["']$/g, '');
  const email = match[2].trim();
  if (!displayName || /^[\x20-\x7E]+$/.test(displayName)) return `${displayName} <${email}>`;
  return `${mimeBase64Word(displayName)} <${email}>`;
}

function envFirst(env = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = String(env[key] || '').trim();
    if (value) return value;
  }
  return fallback;
}

export async function sendSesEmail({ to, subject, text, html, from = '' } = {}, env = {}) {
  const region = envFirst(env, ['AWS_SES_REGION', 'INLET_AWS_SES_REGION', 'AWS_REGION'], 'ap-northeast-2');
  const accessKeyId = envFirst(env, ['AWS_SES_ACCESS_KEY_ID', 'INLET_AWS_SES_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'SES_ACCESS_KEY_ID', 'Access key ID']);
  const secretAccessKey = envFirst(env, ['AWS_SES_SECRET_ACCESS_KEY', 'INLET_AWS_SES_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'SES_SECRET_ACCESS_KEY', 'Secret access key']);
  const fromAddress = normalizeSesFromAddress(from || envFirst(env, ['INLET_LEAD_EMAIL_FROM', 'INLET_AUTH_EMAIL_FROM', 'AWS_SES_FROM'], '페이지로 <support@pagero.kr>'));
  const toAddress = normalizeEmailAddress(to);

  if (!region || !fromAddress) {
    const error = new Error('메일 발송 설정이 필요합니다.');
    error.code = 'EMAIL_SEND_NOT_CONFIGURED';
    throw error;
  }
  if (!accessKeyId || !secretAccessKey) {
    const error = new Error('SES 키가 설정되지 않았습니다.');
    error.code = 'EMAIL_SEND_KEY_MISSING';
    throw error;
  }
  if (!isValidEmailAddress(toAddress)) {
    const error = new Error('받을 이메일 주소를 확인해주세요.');
    error.code = 'EMAIL_TO_INVALID';
    throw error;
  }

  const body = JSON.stringify({
    FromEmailAddress: fromAddress,
    Destination: { ToAddresses: [toAddress] },
    Content: {
      Simple: {
        Subject: { Data: String(subject || '페이지로 알림'), Charset: 'UTF-8' },
        Body: {
          Text: { Data: String(text || ''), Charset: 'UTF-8' },
          Html: { Data: String(html || text || ''), Charset: 'UTF-8' },
        },
      },
    },
  });

  const host = `email.${region}.amazonaws.com`;
  const path = '/v2/email/outbound-emails';
  const now = new Date();
  const amzDate = awsAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);
  const canonicalHeaders = [
    'content-type:application/json',
    `host:${host}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/ses/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = await awsSigningKey(secretAccessKey, dateStamp, region, 'ses');
  const signature = bytesToHex(await hmacBytesRaw(signingKey, stringToSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  let res;
  try {
    res = await fetch(`https://${host}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        Authorization: authorization,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    const error = new Error('메일 발송 시간이 초과되었습니다.');
    error.code = 'EMAIL_SEND_TIMEOUT';
    throw error;
  }

  const responseText = await res.text();
  let responseData = {};
  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseData = {};
  }
  if (!res.ok) {
    const error = new Error('메일 발송에 실패했습니다.');
    error.code = classifySesError(responseData, res.status);
    error.httpStatus = res.status;
    error.providerMessage = String(responseData.message || responseData.Message || '').slice(0, 500);
    throw error;
  }

  return {
    ok: true,
    provider: 'ses',
    messageId: responseData.MessageId || responseData.messageId || '',
  };
}

function classifySesError(responseData = {}, status = 500) {
  const raw = String(responseData.__type || responseData.message || responseData.Message || '').toLowerCase();
  if (raw.includes('sandbox')) return 'EMAIL_SEND_SANDBOX_REJECTED';
  if (status === 429 || raw.includes('throttl') || raw.includes('limit') || raw.includes('quota') || raw.includes('maximum sending rate')) return 'EMAIL_SEND_QUOTA_EXCEEDED';
  if (raw.includes('email address is not verified') || raw.includes('recipient') || raw.includes('destination')) return 'EMAIL_RECIPIENT_NOT_VERIFIED';
  if (raw.includes('notverified') || raw.includes('identity') || raw.includes('fromemailaddress')) return 'EMAIL_DOMAIN_NOT_VERIFIED';
  return 'EMAIL_SEND_PROVIDER_ERROR';
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
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return new Uint8Array(signature);
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
