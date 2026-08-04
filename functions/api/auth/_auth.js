import { getD1AccountByEmail, getD1AccountByPhone, upsertD1Account } from '../../../server/storage/d1Adapter.mjs';

export const AUTH_METHODS = 'GET, POST, PATCH, OPTIONS';


export const AUTH_EMAIL_VERIFICATION_PURPOSES = Object.freeze([
  'signup',
  'password-reset',
  'email-change',
]);

export function normalizeEmailVerificationPurpose(value = '') {
  const purpose = String(value || '').trim().toLowerCase();
  return AUTH_EMAIL_VERIFICATION_PURPOSES.includes(purpose) ? purpose : '';
}

function requireEmailVerificationPurpose(value = '') {
  const purpose = normalizeEmailVerificationPurpose(value);
  if (!purpose) {
    throw authError('Email verification purpose is invalid.', 400, {
      code: 'EMAIL_VERIFICATION_PURPOSE_INVALID',
    });
  }
  return purpose;
}

const consumedFallbackVerificationTokens = new Set();

function rememberConsumedFallbackVerificationToken(fingerprint = '') {
  if (!fingerprint) return true;
  if (consumedFallbackVerificationTokens.has(fingerprint)) return false;
  consumedFallbackVerificationTokens.add(fingerprint);
  while (consumedFallbackVerificationTokens.size > 2000) {
    consumedFallbackVerificationTokens.delete(consumedFallbackVerificationTokens.values().next().value);
  }
  return true;
}

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


export async function accountSessionVersion(user = {}, env = {}) {
  const ownerId = String(user.ownerId || user.id || '').trim();
  const email = normalizeEmail(user.email || '');
  if (!ownerId || !email) return '';
  const material = JSON.stringify({
    ownerId,
    email,
    passwordHash: String(user.passwordHash || user.password_hash || ''),
    status: normalizeAccountStatus(user.status || 'active'),
    emailVerifiedAt: String(user.emailVerifiedAt || user.email_verified_at || ''),
  });
  return hmacHex(`account-session:v1:${material}`, authSecret(env));
}

async function sessionAccountForToken(input = {}, env = {}) {
  const email = normalizeEmail(input.email || input.user?.email || input.account?.email || '');
  if (env.DB?.prepare && email) {
    return getD1AccountByEmail(env.DB, email);
  }
  return input.user || input.account || null;
}

function revokedSessionError() {
  return authError('Session was revoked. Please sign in again.', 401, {
    code: 'AUTH_SESSION_REVOKED',
  });
}

export async function createSessionToken(input = {}, env = {}) {
  const secret = authSecret(env);
  if (!secret) return '';
  const now = Math.floor(Date.now() / 1000);
  const email = normalizeEmail(input.email || input.user?.email || input.account?.email || '');
  const account = await sessionAccountForToken({ ...input, email }, env);
  const sessionVersion = account
    ? await accountSessionVersion(account, env)
    : String(input.sessionVersion || '').trim();
  const payload = {
    ownerId: String(input.ownerId || account?.ownerId || account?.id || ''),
    projectId: String(input.projectId || ''),
    role: String(input.role || 'master'),
    email,
    ...(sessionVersion ? { sessionVersion } : {}),
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
  if (payload.ownerId && String(payload.ownerId) !== String(user.ownerId || user.id || '')) {
    throw revokedSessionError();
  }
  assertAccountActive(user, 'refresh session');
  if (user.emailVerified !== true) throw authError('Email verification is required before session refresh.', 403, { code: 'EMAIL_VERIFICATION_REQUIRED' });

  const expectedSessionVersion = await accountSessionVersion(user, env);
  if (payload.sessionVersion) {
    if (!expectedSessionVersion || String(payload.sessionVersion) !== expectedSessionVersion) {
      throw revokedSessionError();
    }
  } else {
    const issuedAtMs = Number(payload.iat || 0) * 1000;
    const accountUpdatedAtMs = Date.parse(user.updatedAt || '');
    if (!issuedAtMs || (Number.isFinite(accountUpdatedAtMs) && accountUpdatedAtMs > issuedAtMs + 1000)) {
      throw revokedSessionError();
    }
  }
  return { payload, user };
}

export async function issueEmailVerificationToken(input = {}, env = {}) {
  const email = normalizeEmail(input.email || '');
  const purpose = requireEmailVerificationPurpose(input.purpose || 'signup');
  if (!isValidEmail(email)) throw authError('Valid email is required.', 400, { code: 'AUTH_EMAIL_REQUIRED' });
  if (purpose === 'signup' && env.DB?.prepare && await getD1AccountByEmail(env.DB, email)) {
    throw authError('Email is already registered.', 409, { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' });
  }

  const provider = emailProvider(env);
  assertAuthEmailDeliveryReady(provider, env);

  const now = Math.floor(Date.now() / 1000);
  await assertEmailVerificationSendAllowed(env.DB, { email, purpose, now });
  const expiresAt = new Date((now + 60 * 30) * 1000).toISOString();
  const code = verificationCode();
  const stored = await storeEmailVerificationCode(env.DB, { email, purpose, code, expiresAt }, env);

  if (provider !== 'mock' && !stored.ok) {
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code: 'EMAIL_VERIFICATION_STORAGE_FAILED',
      provider,
    });
  }

  const payload = { email, purpose, iat: now, exp: now + 60 * 30 };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signedFallbackToken = `${payloadPart}.${await hmacBase64Url(payloadPart, authSecret(env))}`;
  const token = stored.ok ? code : signedFallbackToken;

  let delivery;
  try {
    delivery = await deliverAuthEmail({ email, purpose, token: code, expiresAt }, env, provider);
  } catch (error) {
    const cleanupOk = stored.id
      ? await removeEmailVerificationCode(env.DB, { id: stored.id, email, purpose })
      : true;
    if (!cleanupOk) {
      console.error('auth email verification cleanup failed', {
        code: 'EMAIL_VERIFICATION_CLEANUP_FAILED',
        provider,
      });
    }
    throw sanitizedAuthEmailDeliveryError(error, provider);
  }

  const exposeToken = shouldExposeVerificationToken(env, delivery);
  return {
    email,
    purpose,
    status: 'pending',
    expiresAt,
    delivery,
    ...(exposeToken ? { token } : {}),
  };
}

async function assertEmailVerificationSendAllowed(db, input = {}) {
  if (!db?.prepare) return;
  const nowMs = Number(input.now || Math.floor(Date.now() / 1000)) * 1000;
  const cooldownAt = new Date(nowMs - 60 * 1000).toISOString();
  const dailyAt = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

  const recent = await db.prepare(`
    SELECT id, created_at
    FROM auth_email_verifications
    WHERE email = ? AND purpose = ? AND created_at >= ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(input.email, input.purpose, cooldownAt).first();
  if (recent) {
    throw authError('Verification email was requested too recently.', 429, {
      code: 'EMAIL_VERIFICATION_COOLDOWN',
      retryAfterSeconds: 60,
    });
  }

  const daily = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM auth_email_verifications
    WHERE email = ? AND purpose = ? AND created_at >= ?
  `).bind(input.email, input.purpose, dailyAt).first();
  if (Number(daily?.count || 0) >= 20) {
    throw authError('Too many verification emails were requested today.', 429, {
      code: 'EMAIL_VERIFICATION_DAILY_LIMIT',
      retryAfterSeconds: 60 * 60,
    });
  }
}

export async function confirmEmailVerificationToken(input = {}, env = {}) {
  const email = normalizeEmail(input.email || '');
  const token = String(input.token || '').trim();
  const purpose = requireEmailVerificationPurpose(input.purpose);
  const consume = input.consume === true;
  if (!isValidEmail(email)) throw authError('Valid email is required.', 400, { code: 'AUTH_EMAIL_REQUIRED' });
  if (!token) throw authError('Email verification token is required.', 400, { code: 'EMAIL_VERIFICATION_TOKEN_REQUIRED' });
  const stored = await confirmStoredEmailVerificationCode(env.DB, {
    email,
    purpose,
    code: token,
    consume,
  }, env);
  if (stored) return stored;
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
  if (normalizeEmail(payload.email || '') !== email || requireEmailVerificationPurpose(payload.purpose) !== purpose) {
    throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
  }
  if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) throw authError('Email verification token has expired.', 410, { code: 'EMAIL_VERIFICATION_EXPIRED' });
  const confirmedAt = new Date().toISOString();
  if (consume) {
    const fingerprint = await hmacHex(`fallback:${token}`, authSecret(env));
    if (!rememberConsumedFallbackVerificationToken(fingerprint)) {
      throw authError('Email verification token was already used.', 409, {
        code: 'EMAIL_VERIFICATION_ALREADY_USED',
      });
    }
  }
  return {
    email,
    purpose,
    status: consume ? 'consumed' : 'confirmed',
    confirmedAt,
    ...(consume ? { consumedAt: confirmedAt } : {}),
    delivery: { mode: 'mock', status: consume ? 'consumed' : 'confirmed' },
  };
}

function verificationCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, '0');
}

function verificationId() {
  return crypto.randomUUID?.() || `email-verification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function storeEmailVerificationCode(db, record = {}, env = {}) {
  if (!db?.prepare) return { ok: false, id: '' };
  const id = verificationId();
  const codeHash = await hmacHex(`${record.email}:${record.purpose}:${record.code}`, authSecret(env));
  try {
    await db.prepare(`
      UPDATE auth_email_verifications
      SET status = 'superseded'
      WHERE email = ? AND purpose = ? AND status IN ('pending', 'confirmed')
    `).bind(record.email, record.purpose).run();
    await db.prepare(`
      INSERT INTO auth_email_verifications (id, email, purpose, code_hash, status, attempts, expires_at)
      VALUES (?, ?, ?, ?, 'pending', 0, ?)
    `).bind(id, record.email, record.purpose, codeHash, record.expiresAt).run();
    return { ok: true, id };
  } catch {
    console.error('auth email verification persistence failed', {
      code: 'EMAIL_VERIFICATION_STORAGE_FAILED',
    });
    return { ok: false, id: '' };
  }
}

async function removeEmailVerificationCode(db, record = {}) {
  if (!db?.prepare || !record.id) return false;
  try {
    await db.prepare(`
      DELETE FROM auth_email_verifications
      WHERE id = ? AND email = ? AND purpose = ? AND status = 'pending'
    `).bind(record.id, record.email, record.purpose).run();
    return true;
  } catch {
    return false;
  }
}

async function confirmStoredEmailVerificationCode(db, input = {}, env = {}) {
  if (!db?.prepare || !/^\d{6}$/.test(String(input.code || ''))) return null;
  const rows = await db.prepare(`
    SELECT id, email, purpose, code_hash, status, attempts, expires_at, confirmed_at
    FROM auth_email_verifications
    WHERE email = ? AND purpose = ? AND status IN ('pending', 'confirmed', 'consumed')
    ORDER BY created_at DESC
    LIMIT 5
  `).bind(input.email, input.purpose).all();
  const records = rows?.results || [];
  const now = Date.now();
  for (const record of records) {
    if (Date.parse(record.expires_at || '') <= now) {
      if (String(record.status || '') !== 'consumed') {
        await db.prepare("UPDATE auth_email_verifications SET status = 'expired' WHERE id = ? AND status IN ('pending', 'confirmed')").bind(record.id).run();
      }
      continue;
    }
    if (Number(record.attempts || 0) >= 5 && String(record.status || '') !== 'consumed') {
      await db.prepare("UPDATE auth_email_verifications SET status = 'blocked' WHERE id = ? AND status IN ('pending', 'confirmed')").bind(record.id).run();
      continue;
    }
    const expected = await hmacHex(`${input.email}:${input.purpose}:${input.code}`, authSecret(env));
    if (expected === record.code_hash) {
      if (String(record.status || '') === 'consumed') {
        throw authError('Email verification token was already used.', 409, {
          code: 'EMAIL_VERIFICATION_ALREADY_USED',
        });
      }
      const confirmedAt = record.confirmed_at || new Date().toISOString();
      if (input.consume === true) {
        const result = await db.prepare(`
          UPDATE auth_email_verifications
          SET status = 'consumed', confirmed_at = COALESCE(confirmed_at, ?)
          WHERE id = ? AND email = ? AND purpose = ? AND status IN ('pending', 'confirmed')
        `).bind(confirmedAt, record.id, input.email, input.purpose).run();
        const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
        if (changes !== 1) {
          throw authError('Email verification token was already used.', 409, {
            code: 'EMAIL_VERIFICATION_ALREADY_USED',
          });
        }
        return {
          email: input.email,
          purpose: input.purpose,
          status: 'consumed',
          confirmedAt,
          consumedAt: new Date().toISOString(),
          delivery: { mode: 'api', status: 'consumed' },
        };
      }
      if (String(record.status || '') === 'pending') {
        await db.prepare(`
          UPDATE auth_email_verifications
          SET status = 'confirmed', confirmed_at = ?
          WHERE id = ? AND email = ? AND purpose = ? AND status = 'pending'
        `).bind(confirmedAt, record.id, input.email, input.purpose).run();
      }
      return {
        email: input.email,
        purpose: input.purpose,
        status: 'confirmed',
        confirmedAt,
        delivery: { mode: 'api', status: 'confirmed' },
      };
    }
    if (String(record.status || '') !== 'consumed') {
      await db.prepare(`
        UPDATE auth_email_verifications
        SET attempts = attempts + 1
        WHERE id = ? AND email = ? AND purpose = ? AND status IN ('pending', 'confirmed')
      `).bind(record.id, input.email, input.purpose).run();
    }
  }
  throw authError('Email verification token is invalid.', 403, { code: 'EMAIL_VERIFICATION_INVALID' });
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
  if (await getD1AccountByEmail(env.DB, email)) throw authError('Email is already registered.', 409, { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' });
  if (await getD1AccountByPhone(env.DB, phone)) throw authError('Phone number is already registered.', 409, { code: 'AUTH_PHONE_DUPLICATE', field: 'phone' });
  const verification = await confirmEmailVerificationToken({
    email,
    token,
    purpose: 'signup',
    consume: true,
  }, env);
  const now = new Date().toISOString();
  const user = await upsertD1Account(env.DB, {
    id: ownerIdForEmail(email),
    ownerId: ownerIdForEmail(email),
    name: name || email,
    email,
    phone,
    phoneVerified: false,
    emailVerified: true,
    emailVerifiedAt: verification.confirmedAt || now,
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

function isProductionAuthEmailRuntime(env = {}) {
  const branch = String(env.CF_PAGES_BRANCH || '').trim().toLowerCase();
  const environment = String(
    env.INLET_RUNTIME_ENV
      || env.INLET_ENVIRONMENT
      || env.NODE_ENV
      || env.ENVIRONMENT
      || '',
  ).trim().toLowerCase();
  return branch === 'main' || environment === 'production';
}

function emailProvider(env = {}) {
  const mode = String(env.INLET_AUTH_EMAIL_MODE || 'mock').trim().toLowerCase();
  if (mode === 'api' || mode === 'ses') return String(env.INLET_EMAIL_PROVIDER || 'ses').trim().toLowerCase();
  return 'mock';
}

function shouldExposeVerificationToken(env = {}, delivery = {}) {
  if (isProductionAuthEmailRuntime(env)) return false;
  if (delivery.mode !== 'mock') return false;
  return String(env.INLET_AUTH_EMAIL_EXPOSE_TOKEN || '1').trim() !== '0';
}

function normalizeSesRegion(value = '') {
  const region = String(value || '').trim().toLowerCase();
  return /^(?:af|ap|ca|eu|il|me|mx|sa|us)-(?:central|east|north|northeast|northwest|south|southeast|southwest|west)-\d$/.test(region)
    ? region
    : '';
}

function boundedAuthEmailTimeout(value = '') {
  const parsed = Number(value || 10000);
  if (!Number.isFinite(parsed)) return 10000;
  return Math.min(60000, Math.max(5000, Math.trunc(parsed)));
}

function sesApiOrigin(region = '') {
  const normalized = normalizeSesRegion(region);
  return normalized ? `https://email.${normalized}.amazonaws.com` : '';
}

function sesAuthEmailConfig(env = {}) {
  const region = normalizeSesRegion(envFirst(env, ['AWS_SES_REGION', 'INLET_AWS_SES_REGION', 'AWS_REGION'], 'ap-northeast-2'));
  const accessKeyId = envFirst(env, ['AWS_SES_ACCESS_KEY_ID', 'INLET_AWS_SES_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'SES_ACCESS_KEY_ID', 'Access key ID']);
  const secretAccessKey = envFirst(env, ['AWS_SES_SECRET_ACCESS_KEY', 'INLET_AWS_SES_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'SES_SECRET_ACCESS_KEY', 'Secret access key']);
  const sender = normalizeSesFromAddress(envFirst(env, ['INLET_AUTH_EMAIL_FROM', 'INLET_LEAD_EMAIL_FROM', 'AWS_SES_FROM']));
  const ok = !!region
    && accessKeyId.length >= 16
    && accessKeyId.length <= 128
    && secretAccessKey.length >= 32
    && secretAccessKey.length <= 256
    && !!sender;
  return {
    ok,
    region,
    accessKeyId,
    secretAccessKey,
    sender,
    timeoutMs: boundedAuthEmailTimeout(env.INLET_AUTH_EMAIL_TIMEOUT_MS || env.INLET_INTEGRATION_TIMEOUT_MS),
  };
}

function assertAuthEmailDeliveryReady(provider = '', env = {}) {
  if (provider === 'mock') {
    if (isProductionAuthEmailRuntime(env)) {
      throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
        code: 'EMAIL_SEND_NOT_CONFIGURED',
        provider: 'mock',
      });
    }
    return;
  }
  if (provider !== 'ses') {
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code: 'EMAIL_SEND_PROVIDER_UNSUPPORTED',
      provider,
    });
  }
  if (!sesAuthEmailConfig(env).ok) {
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code: 'EMAIL_SEND_NOT_CONFIGURED',
      provider: 'ses',
    });
  }
}

function sanitizedAuthEmailDeliveryError(error, provider = '') {
  const allowedCodes = new Set([
    'EMAIL_SEND_NOT_CONFIGURED',
    'EMAIL_SEND_PROVIDER_UNSUPPORTED',
    'EMAIL_SEND_TIMEOUT',
    'EMAIL_SEND_SANDBOX_REJECTED',
    'EMAIL_DOMAIN_NOT_VERIFIED',
    'EMAIL_SEND_QUOTA_EXCEEDED',
    'EMAIL_SEND_PROVIDER_ERROR',
    'EMAIL_VERIFICATION_STORAGE_FAILED',
  ]);
  const candidate = String(error?.details?.code || '');
  const code = allowedCodes.has(candidate) ? candidate : 'EMAIL_SEND_PROVIDER_ERROR';
  return authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
    code,
    provider: provider === 'ses' ? 'ses' : String(provider || 'unknown'),
  });
}

function envFirst(env = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = String(env[key] || '').trim();
    if (value) return value;
  }
  return fallback;
}

export function googleAuthRedirectUri(request, env = {}) {
  const configured = String(env.GOOGLE_AUTH_REDIRECT_URI || '').trim();
  if (configured) return configured;
  return new URL('/api/auth/login', request.url).toString();
}

export async function googleLoginAuthUrl(request, env = {}, input = {}) {
  const clientId = googleAuthClientId(env);
  if (!clientId) throw authError('Google login is not configured.', 503, { code: 'GOOGLE_AUTH_NOT_CONFIGURED' });
  const state = await signedGoogleAuthState({
    projectId: String(input.projectId || ''),
    next: safeGoogleAuthNext(input.next || '/'),
  }, env);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', googleAuthRedirectUri(request, env));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function loginGoogleAccount(input = {}, env = {}) {
  const code = String(input.code || '').trim();
  const state = String(input.state || '').trim();
  const statePayload = await verifyGoogleAuthState(state, env);
  if (!code || !statePayload) throw authError('Google login request is invalid.', 400, { code: 'GOOGLE_AUTH_INVALID' });

  const token = await exchangeGoogleAuthCode({
    code,
    clientId: googleAuthClientId(env),
    clientSecret: googleAuthClientSecret(env),
    redirectUri: input.redirectUri || '',
  });
  const profile = await fetchGoogleAuthProfile(token.access_token || '');
  const email = normalizeEmail(profile.email || '');
  if (!isValidEmail(email) || profile.email_verified === false) {
    throw authError('Google account email is not verified.', 403, { code: 'GOOGLE_EMAIL_NOT_VERIFIED' });
  }

  const now = new Date().toISOString();
  let user = await getD1AccountByEmail(env.DB, email);
  if (user) {
    assertAccountActive(user, 'google login');
    if (user.emailVerified !== true) {
      user = await upsertD1Account(env.DB, {
        ...user,
        email,
        name: user.name || profile.name || email,
        emailVerified: true,
        emailVerifiedAt: now,
        updatedAt: now,
      });
    }
  } else {
    user = await upsertD1Account(env.DB, {
      id: ownerIdForEmail(email),
      ownerId: ownerIdForEmail(email),
      name: String(profile.name || profile.given_name || email).trim(),
      email,
      phone: '',
      phoneVerified: false,
      emailVerified: true,
      passwordHash: '',
      status: 'active',
      source: 'google',
      createdAt: now,
      updatedAt: now,
    });
  }

  const publicUser = authUserPublic(user);
  const session = await createSessionToken({
    ownerId: publicUser.ownerId,
    projectId: String(statePayload.projectId || input.projectId || ''),
    role: 'master',
    email: publicUser.email,
  }, env);
  return {
    user: publicUser,
    session,
    next: safeGoogleAuthNext(statePayload.next || '/'),
  };
}

function googleAuthClientId(env = {}) {
  return String(env.GOOGLE_AUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_CLIENT_ID || '').trim();
}

function googleAuthClientSecret(env = {}) {
  return String(env.GOOGLE_AUTH_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || '').trim();
}

async function signedGoogleAuthState(payload = {}, env = {}) {
  const body = base64UrlEncode(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  }));
  return `${body}.${await hmacBase64Url(body, authSecret(env))}`;
}

async function verifyGoogleAuthState(state = '', env = {}) {
  const [body, signature] = String(state || '').split('.');
  if (!body || !signature) return null;
  if (await hmacBase64Url(body, authSecret(env)) !== signature) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function exchangeGoogleAuthCode({ code, clientId, clientSecret, redirectUri } = {}) {
  if (!clientId || !clientSecret || !redirectUri) {
    throw authError('Google login is not configured.', 503, { code: 'GOOGLE_AUTH_NOT_CONFIGURED' });
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw authError('Google login failed.', 502, { code: 'GOOGLE_AUTH_EXCHANGE_FAILED' });
  }
  return data;
}

async function fetchGoogleAuthProfile(accessToken = '') {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw authError('Google profile request failed.', 502, { code: 'GOOGLE_PROFILE_FAILED' });
  return data;
}

function safeGoogleAuthNext(value = '/') {
  const next = String(value || '/').trim();
  if (!next || !next.startsWith('/') || next.startsWith('//') || /^\/api(?:\/|$)/.test(next)) return '/';
  return next;
}

function normalizeSesFromAddress(value = '') {
  const from = String(value || '').trim();
  if (!from) return '';
  const match = from.match(/^(.+?)<([^<>]+)>$/);
  if (!match) {
    const email = normalizeEmail(from);
    return isValidEmail(email) ? email : '';
  }
  const displayName = match[1].trim().replace(/^["']|["']$/g, '');
  const email = normalizeEmail(match[2]);
  if (!isValidEmail(email)) return '';
  if (!displayName) return email;
  if (/^[\x20-\x7E]+$/.test(displayName)) return `${displayName} <${email}>`;
  return `${mimeBase64Word(displayName)} <${email}>`;
}

function mimeBase64Word(value = '') {
  const bytes = new TextEncoder().encode(String(value || ''));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

async function deliverAuthEmail(message = {}, env = {}, provider = emailProvider(env)) {
  const nextMessage = {
    ...message,
    supportEmail: String(env.INLET_SUPPORT_EMAIL || 'support@pagero.kr').trim() || 'support@pagero.kr',
  };
  if (provider === 'mock') {
    return {
      mode: 'mock',
      provider: 'mock',
      status: 'issued',
      message: 'Offline QA mode returns the verification token in the API response.',
    };
  }
  if (provider === 'ses') return sendSesAuthEmail(nextMessage, env);
  throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
    code: 'EMAIL_SEND_PROVIDER_UNSUPPORTED',
    provider,
  });
}

async function sendSesAuthEmail(message = {}, env = {}) {
  const config = sesAuthEmailConfig(env);
  if (!config.ok) {
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code: 'EMAIL_SEND_NOT_CONFIGURED',
      provider: 'ses',
    });
  }

  const subject = cleanAuthEmailSubject(message.purpose);
  const text = cleanAuthEmailText(message);
  const html = cleanAuthEmailHtml(message);
  const body = JSON.stringify({
    FromEmailAddress: config.sender,
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

  const path = '/v2/email/outbound-emails';
  const origin = sesApiOrigin(config.region);
  const url = new URL(path, origin);
  if (!origin || url.origin !== origin || url.pathname !== path || url.search || url.hash) {
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code: 'EMAIL_SEND_NOT_CONFIGURED',
      provider: 'ses',
    });
  }

  const host = url.host;
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
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        Authorization: authorization,
      },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch {
    console.error('auth email SES request failed', {
      code: 'EMAIL_SEND_TIMEOUT',
      provider: 'ses',
    });
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code: 'EMAIL_SEND_TIMEOUT',
      provider: 'ses',
    });
  }

  const responseText = (await response.text()).slice(0, 10000);
  let responseData = {};
  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseData = {};
  }
  if (!response.ok) {
    const errorType = String(responseData.__type || responseData.message || responseData.Message || '').toLowerCase();
    const code = errorType.includes('sandbox')
      ? 'EMAIL_SEND_SANDBOX_REJECTED'
      : errorType.includes('notverified') || errorType.includes('identity')
        ? 'EMAIL_DOMAIN_NOT_VERIFIED'
        : response.status === 429 || errorType.includes('throttl') || errorType.includes('limit')
          ? 'EMAIL_SEND_QUOTA_EXCEEDED'
          : 'EMAIL_SEND_PROVIDER_ERROR';
    console.error('auth email SES provider rejected request', {
      code,
      provider: 'ses',
      httpStatus: response.status,
    });
    throw authError('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.', 503, {
      code,
      provider: 'ses',
    });
  }

  return {
    mode: 'api',
    provider: 'ses',
    status: 'sent',
  };
}

function cleanAuthEmailSubject(purpose = 'signup') {
  return String(purpose || '') === 'password-reset'
    ? '[페이지로] 비밀번호 변경 인증 코드'
    : '[페이지로] 이메일 인증 코드';
}

function cleanAuthEmailText(message = {}) {
  const supportEmail = String(message.supportEmail || 'support@pagero.kr').trim();
  const purposeText = String(message.purpose || '') === 'password-reset' ? '비밀번호 변경' : '이메일 인증';
  return [
    `페이지로 ${purposeText} 코드입니다.`,
    '',
    '아래 6자리 코드를 인증 화면에 입력해주세요.',
    '',
    String(message.token || ''),
    '',
    '이 코드는 전송 후 30분이 지나면 만료됩니다.',
    `만료 시간: ${message.expiresAt || '-'}`,
    '',
    `본인이 요청하지 않았다면 고객센터(${supportEmail})로 문의해주세요.`,
    '',
    '페이지로',
    '대표 김도윤 · 사업자번호 538-42-01450',
    `고객센터: ${supportEmail}`,
  ].join('\n');
}

function cleanAuthEmailHtml(message = {}) {
  const supportEmail = escapeHtml(String(message.supportEmail || 'support@pagero.kr').trim());
  const purposeText = String(message.purpose || '') === 'password-reset' ? '비밀번호 변경' : '이메일 인증';
  const token = escapeHtml(message.token || '');
  return `<!doctype html>
<html lang="ko">
<body style="margin:0;background:#f3f6fb;padding:32px 16px;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#101828;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:24px;box-shadow:0 18px 50px rgba(15,23,42,.10);overflow:hidden;">
    <div style="padding:30px 30px 18px;text-align:center;">
      <div style="display:inline-block;margin-bottom:14px;padding:7px 12px;border-radius:999px;background:#eef4ff;color:#1d4ed8;font-size:13px;font-weight:800;">페이지로 인증 메일</div>
      <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:900;color:#0f172a;">${escapeHtml(purposeText)} 인증 코드</h1>
      <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#667085;">아래 6자리 코드를 인증 화면에 입력해주세요.</p>
    </div>
    <div style="margin:0 30px 22px;padding:24px 16px;border-radius:20px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;">
      <div style="font-size:13px;font-weight:900;color:#475569;margin-bottom:8px;">확인 코드</div>
      <div style="font-size:48px;line-height:1;font-weight:950;letter-spacing:6px;color:#020617;">${token}</div>
      <div style="margin-top:14px;font-size:13px;font-weight:800;color:#64748b;">30분 후 만료됩니다.</div>
    </div>
    <div style="padding:0 30px 28px;text-align:center;">
      <p style="margin:0;font-size:13px;line-height:1.7;color:#64748b;">본인이 요청하지 않았다면 고객센터(<a href="mailto:${supportEmail}" style="color:#2563eb;text-decoration:none;font-weight:800;">${supportEmail}</a>)로 문의해주세요.<br>인증 코드는 계정 보안을 위해 다른 사람에게 공유하지 마세요.</p>
    </div>
    <div style="padding:18px 30px;background:#0f172a;color:#cbd5e1;text-align:center;font-size:12px;line-height:1.6;">
      <strong style="display:block;color:#ffffff;font-size:14px;letter-spacing:.4px;">페이지로</strong>
      대표 김도윤 · 사업자번호 538-42-01450<br>
      고객센터: <a href="mailto:${supportEmail}" style="color:#dbeafe;text-decoration:none;">${supportEmail}</a>
    </div>
  </div>
</body>
</html>`;
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
