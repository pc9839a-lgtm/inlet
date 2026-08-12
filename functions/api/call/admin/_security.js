import { callError } from '../_shared.js';

const ACCESS_KEY_CACHE = new Map();
const RATE_BUCKETS = new Map();
const ADMIN_METHODS = 'GET, OPTIONS';

export function adminJson(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      pragma: 'no-cache',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    },
  });
}

export function adminOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: ADMIN_METHODS,
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  });
}

export function adminErrorResponse(error) {
  const status = Number(error?.status || 500);
  const safeStatus = status >= 400 && status <= 599 ? status : 500;
  const code = String(error?.details?.code || (safeStatus >= 500 ? 'CALLTAG_ADMIN_INTERNAL_ERROR' : 'CALLTAG_ADMIN_REQUEST_FAILED'));
  const safeMessage = safeStatus >= 500 && !code.includes('CONFIG') && code !== 'CALLTAG_ADMIN_DISABLED'
    ? '관리자 요청을 처리하지 못했습니다.'
    : String(error?.message || '관리자 요청을 처리하지 못했습니다.');
  return adminJson(safeStatus, { ok: false, error: safeMessage, code });
}

export async function requireCalltagAdmin(request, env = {}) {
  if (String(env.CALLTAG_ADMIN_ENABLED || '').trim() !== '1') {
    throw callError('콜태그 관리자 기능이 비활성화되어 있습니다.', 503, { code: 'CALLTAG_ADMIN_DISABLED' });
  }
  if (!env.DB?.prepare) {
    throw callError('관리자 저장소가 연결되지 않았습니다.', 503, { code: 'CALLTAG_ADMIN_DB_REQUIRED' });
  }

  const issuer = normalizeIssuer(env.CALLTAG_ADMIN_ACCESS_ISS || '');
  const allowedAudiences = csv(env.CALLTAG_ADMIN_ACCESS_AUD || '');
  if (!issuer || !allowedAudiences.length) {
    throw callError('관리자 Access 설정이 완료되지 않았습니다.', 503, { code: 'CALLTAG_ADMIN_ACCESS_CONFIG_REQUIRED' });
  }

  const assertion = String(request.headers.get('CF-Access-Jwt-Assertion') || '').trim();
  if (!assertion) {
    throw callError('Cloudflare Access 인증이 필요합니다.', 401, { code: 'CALLTAG_ADMIN_ACCESS_REQUIRED' });
  }

  const access = await verifyAccessAssertion(assertion, issuer, allowedAudiences);
  const accessEmail = normalizeEmail(access.email || '');
  if (!accessEmail) {
    throw callError('Access 계정 이메일을 확인할 수 없습니다.', 403, { code: 'CALLTAG_ADMIN_ACCESS_EMAIL_REQUIRED' });
  }

  // Admin operators are intentionally independent from customer CallTag accounts.
  // Cloudflare Access verifies the operator identity; the server-side allowlist
  // decides whether that operator may use the backoffice. This avoids requiring
  // an administrator to also exist as a production customer account.
  const actorId = await accessActorId(access.sub || accessEmail);
  const allowedOwnerIds = new Set(csv(env.CALLTAG_ADMIN_OWNER_IDS || ''));
  const allowedEmails = new Set(csv(env.CALLTAG_ADMIN_EMAILS || '').map(normalizeEmail).filter(Boolean));
  if (!allowedOwnerIds.size && !allowedEmails.size) {
    throw callError('관리자 allowlist가 설정되지 않았습니다.', 503, { code: 'CALLTAG_ADMIN_ALLOWLIST_CONFIG_REQUIRED' });
  }
  if (!allowedOwnerIds.has(actorId) && !allowedEmails.has(accessEmail)) {
    throw callError('관리자 권한이 없습니다.', 403, { code: 'CALLTAG_ADMIN_FORBIDDEN' });
  }

  enforceLocalRateLimit(actorId);
  return {
    ownerId: actorId,
    email: accessEmail,
    accessSubject: String(access.sub || '').slice(0, 160),
  };
}

export async function recordAdminAudit(db, request, env, identity, action, targetOwnerId = '', outcome = 'ok') {
  if (!db?.prepare || !identity?.ownerId) return;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS calltag_admin_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_owner_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_owner_id TEXT NOT NULL DEFAULT '',
        outcome TEXT NOT NULL DEFAULT 'ok',
        request_ip_hash TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_calltag_admin_audit_actor_created
      ON calltag_admin_audit(actor_owner_id, created_at DESC)
    `).run();
    const ipHash = await requestIpHash(request, env);
    await db.prepare(`
      INSERT INTO calltag_admin_audit (
        actor_owner_id, action, target_owner_id, outcome, request_ip_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      String(identity.ownerId).slice(0, 120),
      String(action || '').slice(0, 80),
      String(targetOwnerId || '').slice(0, 120),
      String(outcome || 'ok').slice(0, 24),
      ipHash,
    ).run();
  } catch (error) {
    console.warn('calltag-admin-audit-write-failed', String(error?.message || 'audit_failed').slice(0, 120));
  }
}

export function maskEmail(value = '') {
  const email = normalizeEmail(value);
  const at = email.indexOf('@');
  if (at <= 0) return '';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, Math.min(6, local.length - visible.length)))}@${domain}`;
}

export function maskPhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 20);
  if (!digits) return '';
  if (digits.length >= 10 && digits.startsWith('010')) return `010-****-${digits.slice(-4)}`;
  if (digits.length >= 7) return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  return `***${digits.slice(-2)}`;
}

export function ownerIdInput(value = '') {
  const ownerId = String(value || '').trim();
  if (!/^[A-Za-z0-9._:-]{3,120}$/.test(ownerId)) {
    throw callError('회원 식별자가 올바르지 않습니다.', 400, { code: 'CALLTAG_ADMIN_MEMBER_ID_INVALID' });
  }
  return ownerId;
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase().slice(0, 254);
}

function csv(value = '') {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 50);
}

function normalizeIssuer(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

async function accessActorId(subject) {
  const value = String(subject || '').trim().slice(0, 512);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`calltag-admin-actor:v1:${value}`));
  const hex = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `access:${hex.slice(0, 24)}`;
}

async function verifyAccessAssertion(token, issuer, allowedAudiences) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throwAccess('CALLTAG_ADMIN_ACCESS_TOKEN_INVALID');
  let header;
  let payload;
  try {
    header = JSON.parse(decodeBase64UrlText(parts[0]));
    payload = JSON.parse(decodeBase64UrlText(parts[1]));
  } catch {
    throwAccess('CALLTAG_ADMIN_ACCESS_TOKEN_INVALID');
  }
  if (header?.alg !== 'RS256' || !header?.kid) throwAccess('CALLTAG_ADMIN_ACCESS_TOKEN_INVALID');

  const key = await accessVerificationKey(issuer, String(header.kid));
  const verified = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    decodeBase64UrlBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throwAccess('CALLTAG_ADMIN_ACCESS_SIGNATURE_INVALID');

  const now = Math.floor(Date.now() / 1000);
  if (Number(payload?.exp || 0) <= now) throwAccess('CALLTAG_ADMIN_ACCESS_EXPIRED');
  if (payload?.nbf && Number(payload.nbf) > now + 30) throwAccess('CALLTAG_ADMIN_ACCESS_NOT_ACTIVE');
  if (normalizeIssuer(payload?.iss || '') !== issuer) throwAccess('CALLTAG_ADMIN_ACCESS_ISSUER_INVALID');

  const tokenAudiences = Array.isArray(payload?.aud) ? payload.aud.map(String) : [String(payload?.aud || '')];
  if (!allowedAudiences.some((aud) => tokenAudiences.includes(aud))) {
    throwAccess('CALLTAG_ADMIN_ACCESS_AUDIENCE_INVALID');
  }
  return payload;
}

async function accessVerificationKey(issuer, kid) {
  const cacheKey = `${issuer}|${kid}`;
  const cached = ACCESS_KEY_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.key;

  let response;
  try {
    response = await fetch(`${issuer}/cdn-cgi/access/certs`, {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
  } catch {
    throw callError('Access 인증키를 확인하지 못했습니다.', 503, { code: 'CALLTAG_ADMIN_ACCESS_CERTS_UNAVAILABLE' });
  }
  if (!response.ok) {
    throw callError('Access 인증키를 확인하지 못했습니다.', 503, { code: 'CALLTAG_ADMIN_ACCESS_CERTS_UNAVAILABLE' });
  }
  const data = await response.json().catch(() => ({}));
  const jwk = (Array.isArray(data?.keys) ? data.keys : []).find((item) => String(item?.kid || '') === kid);
  if (!jwk) throwAccess('CALLTAG_ADMIN_ACCESS_KEY_NOT_FOUND');
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  ACCESS_KEY_CACHE.set(cacheKey, { key, expiresAt: Date.now() + 5 * 60 * 1000 });
  if (ACCESS_KEY_CACHE.size > 20) ACCESS_KEY_CACHE.delete(ACCESS_KEY_CACHE.keys().next().value);
  return key;
}

function throwAccess(code) {
  throw callError('Cloudflare Access 인증을 확인하지 못했습니다.', 401, { code });
}

function decodeBase64UrlText(value) {
  return new TextDecoder().decode(decodeBase64UrlBytes(value));
}

function decodeBase64UrlBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function enforceLocalRateLimit(ownerId) {
  const now = Date.now();
  const key = String(ownerId || '').slice(0, 120);
  const current = RATE_BUCKETS.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    RATE_BUCKETS.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > 120) {
    throw callError('관리자 요청이 너무 많습니다.', 429, { code: 'CALLTAG_ADMIN_RATE_LIMITED' });
  }
  if (RATE_BUCKETS.size > 100) {
    for (const [bucketKey, bucket] of RATE_BUCKETS) {
      if (now - bucket.startedAt > 120_000) RATE_BUCKETS.delete(bucketKey);
    }
  }
}

async function requestIpHash(request, env = {}) {
  const salt = String(env?.CALLTAG_ADMIN_AUDIT_SALT || '').trim();
  const ip = String(request?.headers?.get?.('CF-Connecting-IP') || '').trim();
  if (!salt || !ip) return '';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`calltag-admin-ip:v1:${ip}`));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
