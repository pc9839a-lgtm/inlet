import { sendSesEmail } from './_ses.js';

const VOWDAY_TO = 'pc9839a@naver.com';
const VOWDAY_FROM = 'VOWDAY <no-reply@pagero.kr>';

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function clean(value = '', max = 1000) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function cleanLine(value = '', max = 1000) {
  return clean(value, max).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function list(value) {
  if (!Array.isArray(value)) return '';
  return value.map((item) => clean(item, 80)).filter(Boolean).join(', ');
}

async function digestHex(value = '') {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sameSecret(actual = '', expected = '') {
  if (!actual || !expected) return false;
  const [a, b] = await Promise.all([digestHex(actual), digestHex(expected)]);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function maskPhone(value = '') {
  const digits = clean(value, 30).replace(/\D+/g, '');
  if (digits.length < 7) return '-';
  return digits.slice(0, 3) + '-****-' + digits.slice(-4);
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const relaySecret = clean(env.VOWDAY_RELAY_SECRET, 200);
  if (!relaySecret) {
    return json({ ok: false, error: 'RELAY_SECRET_NOT_CONFIGURED' }, 503);
  }
  if (request.headers.get('X-VOWDAY-Relay') !== relaySecret) {
    return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: 'INVALID_JSON' }, 400);
  }

  const type = cleanLine(data?.form_type, 20) === 'contract' ? '계약희망설문' : '예약문의';
  const name = cleanLine(data?.name, 40);
  const phone = clean(data?.phone, 30).replace(/\D+/g, '');
  const weddingDate = cleanLine(data?.wedding_date, 20);
  const weddingTime = cleanLine(data?.wedding_time, 20);
  const region = cleanLine(data?.region, 80);
  const venue = cleanLine(data?.venue, 120);

  if (!name || phone.length < 10 || !weddingDate || !venue) {
    return json({ ok: false, error: 'INVALID_PAYLOAD' }, 400);
  }

  const services = list(data?.services) || '-';
  const subject = `[VOWDAY ${type}] ${name} · ${weddingDate} · ${venue}`;

  const text = [
    `VOWDAY ${type} 접수`,
    '',
    `이름: ${name}`,
    `예식일: ${weddingDate}`,
    `예식시간: ${weddingTime || '-'}`,
    `지역: ${region || '-'}`,
    `예식장: ${venue}`,
    `서비스: ${services}`,
    '',
    '연락처와 상세 요청사항은 관리 시트에서 확인해주세요.',
    '관리 시트:',
    'https://docs.google.com/spreadsheets/d/1IzbucniQ1ouDsDIjGjPiHXxfbsVGv8vvVkX3GrhsZV8/edit',
  ].join('\n');

  const html = `<!doctype html>
<html lang="ko">
<body style="margin:0;background:#f4f4f2;padding:28px 14px;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#171717">
  <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e8e6e0;border-radius:20px;overflow:hidden">
    <div style="padding:28px 30px 18px;background:#111;color:#fff">
      <div style="font-size:12px;font-weight:900;letter-spacing:.12em;color:#c8a86e">VOWDAY</div>
      <h1 style="margin:8px 0 0;font-size:24px;line-height:1.3">${type} 접수</h1>
    </div>
    <div style="padding:26px 30px;font-size:14px;line-height:1.8;color:#333;white-space:pre-line">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
  </div>
</body>
</html>`;

  try {
    const result = await sendSesEmail(
      { to: VOWDAY_TO, from: VOWDAY_FROM, subject, text, html },
      env
    );
    return json({ ok: true, provider: result.provider, messageId: result.messageId || '' });
  } catch (error) {
    console.error('VOWDAY SES relay failed', {
      code: String(error?.code || ''),
      status: Number(error?.httpStatus || 0),
      providerMessage: String(error?.providerMessage || '').slice(0, 300),
    });
    return json({ ok: false, error: String(error?.code || 'EMAIL_SEND_FAILED') }, 502);
  }
}
