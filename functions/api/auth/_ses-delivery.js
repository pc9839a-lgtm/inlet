export async function sendAuthVerificationEmail(message = {}, env = {}) {
  const config = sesConfig(env);
  if (!config.ok) {
    throw emailError('EMAIL_SEND_NOT_CONFIGURED', '메일 발송 설정이 필요합니다.');
  }

  const to = normalizeEmail(message.email || message.to || '');
  if (!isValidEmail(to)) {
    throw emailError('EMAIL_TO_INVALID', '받을 이메일 주소를 확인해주세요.');
  }

  const subject = message.purpose === 'password-reset'
    ? '[페이지로] 비밀번호 변경 인증 코드'
    : '[페이지로] 이메일 인증 코드';
  const purposeText = message.purpose === 'password-reset' ? '비밀번호 변경' : '이메일 인증';
  const supportEmail = String(env.INLET_SUPPORT_EMAIL || 'support@pagero.kr').trim() || 'support@pagero.kr';
  const token = String(message.token || '').trim();
  const expiresAt = String(message.expiresAt || '').trim();
  const text = [
    `페이지로 ${purposeText} 코드입니다.`,
    '',
    '아래 6자리 코드를 인증 화면에 입력해주세요.',
    '',
    token,
    '',
    '이 코드는 전송 후 30분이 지나면 만료됩니다.',
    expiresAt ? `만료 시간: ${expiresAt}` : '',
    '',
    `본인이 요청하지 않았다면 고객센터(${supportEmail})로 문의해주세요.`,
  ].filter(Boolean).join('\n');
  const html = `<!doctype html>
<html lang="ko">
<body style="margin:0;background:#f3f6fb;padding:32px 16px;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#101828;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #dbe4f0;border-radius:24px;overflow:hidden;">
    <div style="padding:30px 30px 18px;text-align:center;">
      <div style="display:inline-block;margin-bottom:14px;padding:7px 12px;border-radius:999px;background:#eef4ff;color:#1d4ed8;font-size:13px;font-weight:800;">페이지로 인증 메일</div>
      <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:900;color:#0f172a;">${escapeHtml(purposeText)} 인증 코드</h1>
      <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#667085;">아래 6자리 코드를 인증 화면에 입력해주세요.</p>
    </div>
    <div style="margin:0 30px 22px;padding:24px 16px;border-radius:20px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;">
      <div style="font-size:13px;font-weight:900;color:#475569;margin-bottom:8px;">확인 코드</div>
      <div style="font-size:48px;line-height:1;font-weight:950;letter-spacing:6px;color:#020617;">${escapeHtml(token)}</div>
      <div style="margin-top:14px;font-size:13px;font-weight:800;color:#64748b;">30분 후 만료됩니다.</div>
    </div>
    <div style="padding:0 30px 28px;text-align:center;font-size:13px;line-height:1.7;color:#64748b;">본인이 요청하지 않았다면 고객센터(<a href="mailto:${escapeHtml(supportEmail)}" style="color:#2563eb;text-decoration:none;font-weight:800;">${escapeHtml(supportEmail)}</a>)로 문의해주세요.</div>
  </div>
</body>
</html>`;

  const body = JSON.stringify({
    FromEmailAddress: config.from,
    Destination: { ToAddresses: [to] },
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
  const credentialScope = `${dateStamp}/${config.region}/ses/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = await awsSigningKey(config.secretAccessKey, dateStamp, config.region, 'ses');
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
    console.error('auth verification SES network failure', {
      code: 'EMAIL_SEND_NETWORK_ERROR',
      name: String(error?.name || ''),
      cause: String(error?.cause?.name || ''),
    });
    throw emailError('EMAIL_SEND_NETWORK_ERROR', '메일 서버 연결에 실패했습니다.');
  }

  const responseText = await response.text();
  let responseData = {};
  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseData = {};
  }

  if (!response.ok) {
    const code = classifySesError(responseData, response.status);
    console.error('auth verification SES rejected', { code, httpStatus: response.status });
    throw emailError(code, '메일 발송에 실패했습니다.');
  }

  return {
    ok: true,
    mode: 'api',
    provider: 'ses',
    status: 'sent',
    messageId: String(responseData.MessageId || responseData.messageId || ''),
  };
}

function sesConfig(env = {}) {
  const region = envFirst(env, ['AWS_SES_REGION', 'INLET_AWS_SES_REGION', 'AWS_REGION'], 'ap-northeast-2').toLowerCase();
  const accessKeyId = envFirst(env, ['AWS_SES_ACCESS_KEY_ID', 'INLET_AWS_SES_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'SES_ACCESS_KEY_ID', 'Access key ID']);
  const secretAccessKey = envFirst(env, ['AWS_SES_SECRET_ACCESS_KEY', 'INLET_AWS_SES_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'SES_SECRET_ACCESS_KEY', 'Secret access key']);
  const from = normalizeSesFromAddress(envFirst(env, ['INLET_AUTH_EMAIL_FROM', 'INLET_LEAD_EMAIL_FROM', 'AWS_SES_FROM'], '페이지로 <support@pagero.kr>'));
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

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
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

function classifySesError(responseData = {}, status = 500) {
  const raw = String(responseData.__type || responseData.message || responseData.Message || '').toLowerCase();
  if (raw.includes('sandbox')) return 'EMAIL_SEND_SANDBOX_REJECTED';
  if (status === 429 || raw.includes('throttl') || raw.includes('limit') || raw.includes('quota') || raw.includes('maximum sending rate')) return 'EMAIL_SEND_QUOTA_EXCEEDED';
  if (raw.includes('email address is not verified') || raw.includes('recipient') || raw.includes('destination')) return 'EMAIL_RECIPIENT_NOT_VERIFIED';
  if (raw.includes('notverified') || raw.includes('identity') || raw.includes('fromemailaddress')) return 'EMAIL_DOMAIN_NOT_VERIFIED';
  return 'EMAIL_SEND_PROVIDER_ERROR';
}

function emailError(code = 'EMAIL_SEND_PROVIDER_ERROR', message = '메일 발송에 실패했습니다.') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function mimeBase64Word(value = '') {
  const bytes = new TextEncoder().encode(String(value || ''));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
