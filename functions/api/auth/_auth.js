import { getD1AccountByEmail, getD1AccountByPhone, upsertD1Account } from '../../../server/storage/d1Adapter.mjs';

export const AUTH_METHODS = 'GET, POST, PATCH, OPTIONS';

export function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function normalizePhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('82') && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

export function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function isValidPassword(value = '') {
  const password = String(value || '');
  return password.length >= 6 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function stableHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

export function ownerIdForEmail(email = '') {
  const normalized = normalizeEmail(email);
  return normalized ? `user_${stableHash(normalized)}` : '';
}

export function authUserPublic(user = {}) {
  return {
    id: user.id || '',
    ownerId: user.ownerId || user.id || '',
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    status: normalizeAccountStatus(user.status || 'active'),
    emailVerified: !!user.emailVerified,
    phoneVerified: !!user.phoneVerified,
    suspendedAt: user.suspendedAt || '',
    deletedAt: user.deletedAt || '',
    createdAt: user.createdAt || '',
    updatedAt: user.updatedAt || '',
  };
}

export function normalizeAccountStatus(value = 'active') {
  const status = String(value || 'active').trim().toLowerCase();
  if (status === 'deleted') return 'deleted_pending_retention';
  return ['active', 'pending_verification', 'suspended', 'deleted_pending_retention'].includes(status) ? status : 'active';
}

export function assertAccountActive(user = {}, action = 'use account') {
  const status = normalizeAccountStatus(user.status || 'active');
  if (status === 'active') return;
  const error = new Error(status === 'deleted_pending_retention' ? 'Account is deleted.' : status === 'pending_verification' ? 'Email verification is required.' : 'Account is suspended.');
  error.status = 403;
  error.details = {
    code: status === 'deleted_pending_retention'
      ? 'AUTH_ACCOUNT_DELETED'
      : status === 'pending_verification'
        ? 'EMAIL_VERIFICATION_REQUIRED'
        : 'AUTH_ACCOUNT_SUSPENDED',
    action,
  };
  throw error;
}

export function authError(message, status = 400, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

export async function passwordHash(password = '', email = '', env = {}) {
  const secret = authSecret(env);
  return hmacHex(`${normalizeEmail(email)}:${String(password || '')}`, secret);
}

export function authSecret(env = {}) {
  return String(env.INLET_SESSION_SECRET || env.INLET_API_TOKEN || 'inlet-local-auth-secret');
}

export async function createSessionToken(input = {}, env = {}) {
  const secret = authSecret(env);
  if (!secret) return '';
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ownerId: String(input.ownerId || ''),
    projectId: String(input.projectId || ''),
    role: String(input.role || 'master'),
    email: normalizeEmail(input.email || ''),
    iat: now,
    exp: now + 60 * 60 * 24 * 30,
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  return `${payloadPart}.${await hmacBase64Url(payloadPart, secret)}`;
}

export async function verifySessionToken(token = '', env = {}) {
  const secret = authSecret(env);
  const [payloadPart, signaturePart] = String(token || '').trim().split('.');
  if (!payloadPart || !signaturePart || !secret) return null;
  const expected = await hmacBase64Url(payloadPart, secret);
  if (expected !== signaturePart) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionTokenFromRequest(request, input = {}) {
  return String(input.session || request.headers.get('X-Inlet-Session') || '').trim();
}

export async function getSessionAccount(request, env = {}, input = {}) {
  const payload = await verifySessionToken(sessionTokenFromRequest(request, input), env);
  if (!payload) throw authError('Session is invalid or expired.', 401, { code: 'AUTH_SESSION_INVALID' });
  const email = normalizeEmail(payload.email || input.email || '');
  const user = email ? await getD1AccountByEmail(env.DB, email) : null;
  if (!user) throw authError('Session account was not found.', 404, { code: 'AUTH_ACCOUNT_NOT_FOUND' });
  assertAccountActive(user, 'refresh session');
  if (user.emailVerified !== true) throw authError('Email verification is required before session refresh.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });
  return { payload, user };
}

export async function issueEmailVerificationToken(input = {}, env = {}) {
  const email = normalizeEmail(input.email || '');
  const purpose = String(input.purpose || 'signup').trim() || 'signup';
  if (!isValidEmail(email)) throw authError('Valid email is required.', 400, { code: 'AUTH_EMAIL_REQUIRED' });
  const now = Math.floor(Date.now() / 1000);
  const payload = { email, purpose, iat: now, exp: now + 60 * 15 };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const token = `${payloadPart}.${await hmacBase64Url(payloadPart, authSecret(env))}`;
  const delivery = await deliverAuthEmail({ email, purpose, token, expiresAt: new Date(payload.exp * 1000).toISOString() }, env);
  const exposeToken = shouldExposeVerificationToken(env, delivery);
  return {
    email,
    purpose,
    status: 'pending',
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    delivery,
    ...(exposeToken ? { token } : {}),
  };
}

export async function confirmEmailVerificationToken(input = {}, env = {}) {
  const email = normalizeEmail(input.email || '');
  const token = String(input.token || '').trim();
  if (!isValidEmail(email)) throw authError('Valid email is required.', 400, { code: 'AUTH_EMAIL_REQUIRED' });
  if (!token) throw authError('Email verification token is required.', 400, { code: 'EMAIL_VERIFICATION_TOKEN_REQUIRED' });
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  const expected = await hmacBase64Url(payloadPart, authSecret(env));
  if (expected !== signaturePart) throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadPart));
  } catch {
    throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  }
  if (normalizeEmail(payload.email || '') !== email) throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) throw authError('Email verification token has expired.', 410, { code: 'EMAIL_VERIFICATION_EXPIRED' });
  return {
    email,
    purpose: String(payload.purpose || 'signup'),
    status: 'confirmed',
    confirmedAt: new Date().toISOString(),
    delivery: { mode: 'mock', status: 'confirmed' },
  };
}

export async function registerAccount(input = {}, env = {}) {
  const email = normalizeEmail(input.email || '');
  const phone = normalizePhone(input.phone || '');
  const name = String(input.name || '').trim();
  const password = String(input.password || '');
  const token = String(input.token || input.verificationToken || '').trim();
  if (!isValidEmail(email)) throw authError('Valid email is required.', 400, { code: 'AUTH_EMAIL_REQUIRED' });
  if (!phone) throw authError('Phone number is required.', 400, { code: 'AUTH_PHONE_REQUIRED' });
  if (!isValidPassword(password)) throw authError('Password must include letters and numbers and be at least 6 characters.', 400, { code: 'AUTH_PASSWORD_POLICY' });
  if (!token) throw authError('Email verification is required before signup.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });
  const verification = await confirmEmailVerificationToken({ email, token }, env);
  if (verification.purpose !== 'signup') throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  if (await getD1AccountByEmail(env.DB, email)) throw authError('Email is already registered.', 409, { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' });
  if (await getD1AccountByPhone(env.DB, phone)) throw authError('Phone number is already registered.', 409, { code: 'AUTH_PHONE_DUPLICATE', field: 'phone' });
  const now = new Date().toISOString();
  const user = await upsertD1Account(env.DB, {
    id: ownerIdForEmail(email),
    ownerId: ownerIdForEmail(email),
    name: name || email,
    email,
    phone,
    phoneVerified: false,
    emailVerified: true,
    passwordHash: await passwordHash(password, email, env),
    status: 'active',
    source: String(input.source || 'signup'),
    createdAt: now,
    updatedAt: now,
  });
  return authUserPublic(user);
}

export async function loginAccount(input = {}, env = {}) {
  const email = normalizeEmail(input.email || '');
  const password = String(input.password || '');
  if (!isValidEmail(email) || !password) throw authError('Email and password are required.', 400, { code: 'AUTH_LOGIN_REQUIRED' });
  const user = await getD1AccountByEmail(env.DB, email);
  if (!user || user.passwordHash !== await passwordHash(password, email, env)) throw authError('Email or password is invalid.', 401, { code: 'AUTH_LOGIN_INVALID' });
  assertAccountActive(user, 'login');
  if (user.emailVerified !== true) throw authError('Email verification is required before login.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });
  const publicUser = authUserPublic(user);
  return {
    user: publicUser,
    session: await createSessionToken({
      ownerId: publicUser.ownerId,
      projectId: String(input.projectId || ''),
      role: input.role || 'master',
      email: publicUser.email,
    }, env),
  };
}

async function hmacBase64Url(payloadPart, secret) {
  const signature = await hmacBytes(payloadPart, secret);
  return bytesToBase64Url(signature);
}

async function hmacHex(value, secret) {
  const bytes = await hmacBytes(value, secret);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacBytes(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return new Uint8Array(signature);
}

function base64UrlEncode(value = '') {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value = '') {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function emailProvider(env = {}) {
  const mode = String(env.INLET_AUTH_EMAIL_MODE || 'mock').trim().toLowerCase();
  if (mode === 'api') return String(env.INLET_EMAIL_PROVIDER || 'ses').trim().toLowerCase();
  return 'mock';
}

function shouldExposeVerificationToken(env = {}, delivery = {}) {
  if (String(env.INLET_AUTH_EMAIL_EXPOSE_TOKEN || '').trim() === '1') return true;
  return delivery.mode === 'mock';
}

async function deliverAuthEmail(message = {}, env = {}) {
  const provider = emailProvider(env);
  if (provider === 'mock') {
    return {
      mode: 'mock',
      provider: 'mock',
      status: 'issued',
      message: 'Offline QA mode returns the verification token in the API response.',
    };
  }
  if (provider === 'ses') return sendSesAuthEmail(message, env);
  throw authError('?? ??? ??? ?????. ?? ? ?? ??? ???.', 503, {
    code: 'EMAIL_SEND_PROVIDER_UNSUPPORTED',
    provider,
  });
}

async function sendSesAuthEmail(message = {}, env = {}) {
  const region = String(env.AWS_SES_REGION || env.INLET_AWS_SES_REGION || '').trim();
  const accessKeyId = String(env.AWS_SES_ACCESS_KEY_ID || env.INLET_AWS_SES_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(env.AWS_SES_SECRET_ACCESS_KEY || env.INLET_AWS_SES_SECRET_ACCESS_KEY || '').trim();
  const from = String(env.INLET_AUTH_EMAIL_FROM || '').trim();
  if (!region || !accessKeyId || !secretAccessKey || !from) {
    throw authError('?? ??? ??? ?????. ?? ? ?? ??? ???.', 503, {
      code: 'EMAIL_SEND_NOT_CONFIGURED',
      provider: 'ses',
    });
  }

  const subject = authEmailSubject(message.purpose);
  const text = authEmailText(message);
  const html = authEmailHtml(message);
  const body = JSON.stringify({
    FromEmailAddress: from,
    Destination: { ToAddresses: [message.email] },
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

  const host = `email.${region}.amazonaws.com`;
  const path = '/v2/email/outbound-emails';
  const now = new Date();
  const amzDate = awsAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);
  const canonicalHeaders = [
    `content-type:application/json`,
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
    throw authError('?? ??? ??? ?????. ?? ? ?? ??? ???.', 503, {
      code: 'EMAIL_SEND_TIMEOUT',
      provider: 'ses',
    });
  }

  const responseText = await res.text();
  let responseData = {};
  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseData = {};
  }
  if (!res.ok) {
    const errorType = String(responseData.__type || responseData.message || responseData.Message || '').toLowerCase();
    const code = errorType.includes('sandbox')
      ? 'EMAIL_SEND_SANDBOX_REJECTED'
      : errorType.includes('notverified') || errorType.includes('identity')
        ? 'EMAIL_DOMAIN_NOT_VERIFIED'
        : res.status === 429 || errorType.includes('throttl') || errorType.includes('limit')
          ? 'EMAIL_SEND_QUOTA_EXCEEDED'
          : 'EMAIL_SEND_PROVIDER_ERROR';
    throw authError('?? ??? ??? ?????. ?? ? ?? ??? ???.', 503, {
      code,
      provider: 'ses',
      httpStatus: res.status,
    });
  }

  return {
    mode: 'api',
    provider: 'ses',
    status: 'sent',
    messageId: responseData.MessageId || responseData.messageId || '',
  };
}

function authEmailSubject(purpose = 'signup') {
  return String(purpose || '') === 'password-reset'
    ? '[Inlet] ???? ?? ??? ??'
    : '[Inlet] ???? ??? ??';
}

function authEmailText(message = {}) {
  const purposeText = String(message.purpose || '') === 'password-reset' ? '???? ??' : '????';
  return [
    `Inlet ${purposeText} ??? ?????.`,
    '',
    '?? ?? ??? ??? ??? ?? ???? ???? ???.',
    '',
    message.token,
    '',
    `?? ??: ${message.expiresAt || '-'}`,
    '',
    '??? ???? ???? ? ??? ??? ???.',
  ].join('\n');
}

function authEmailHtml(message = {}) {
  const purposeText = String(message.purpose || '') === 'password-reset' ? '???? ??' : '????';
  const token = escapeHtml(message.token || '');
  return [
    '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">',
    `<h2 style="margin:0 0 12px">Inlet ${escapeHtml(purposeText)} ??? ??</h2>`,
    '<p>?? ?? ??? ??? ??? ?? ???? ???? ???.</p>',
    `<pre style="white-space:pre-wrap;word-break:break-all;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:14px">${token}</pre>`,
    `<p style="color:#6b7280">?? ??: ${escapeHtml(message.expiresAt || '-')}</p>`,
    '<p style="color:#6b7280">??? ???? ???? ? ??? ??? ???.</p>',
    '</div>',
  ].join('');
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
