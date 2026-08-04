const REDACTED_KEY = /(password|passcode|token|secret|authorization|cookie|session|credential|api[_-]?key|access[_-]?key|refresh[_-]?key)/i;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_KEYS = 40;
const MAX_STRING_LENGTH = 500;

function auditId(action = 'audit') {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${String(action || 'audit').replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 48)}-${suffix}`;
}

function normalizeString(value = '', max = MAX_STRING_LENGTH) {
  return String(value ?? '').trim().slice(0, max);
}

function safeMetadataValue(value, depth = 0) {
  if (depth > MAX_METADATA_DEPTH) return '[truncated]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeMetadataValue(item, depth + 1));
  if (typeof value !== 'object') return normalizeString(value);

  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, MAX_METADATA_KEYS)) {
    const safeKey = normalizeString(key, 80);
    if (!safeKey) continue;
    output[safeKey] = REDACTED_KEY.test(safeKey) ? '[redacted]' : safeMetadataValue(item, depth + 1);
  }
  return output;
}

export function sanitizeAuditMetadata(metadata = {}) {
  const safe = safeMetadataValue(metadata, 0);
  return safe && typeof safe === 'object' && !Array.isArray(safe) ? safe : { value: safe };
}

function auditSecret(env = {}) {
  return normalizeString(env.INLET_AUDIT_HASH_SECRET || '', 500);
}

export function hasAuditHashSecret(env = {}) {
  return Boolean(auditSecret(env));
}

async function auditHash(value = '', env = {}) {
  const text = normalizeString(value, 2000);
  const secret = auditSecret(env);
  if (!text || !secret) return '';

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return `sha256:${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function auditSubjectHash(value = '', env = {}) {
  return auditHash(String(value || '').trim().toLowerCase(), env);
}

function requestIp(request) {
  return normalizeString(
    request?.headers?.get?.('CF-Connecting-IP')
      || request?.headers?.get?.('X-Forwarded-For')?.split(',')[0]
      || '',
    200,
  );
}

export async function auditRequestIpHash(request, env = {}) {
  return auditHash(requestIp(request), env);
}

function errorCode(error = {}) {
  return normalizeString(error?.details?.code || error?.code || 'UNKNOWN_ERROR', 100) || 'UNKNOWN_ERROR';
}

export function auditErrorMetadata(error = {}) {
  const status = Math.max(0, Number(error?.status || 0));
  const code = errorCode(error);
  return {
    code,
    status,
    category: code.startsWith('AUTH_LOGIN')
      ? 'credentials'
      : code.includes('VERIFICATION')
        ? 'verification'
        : code.includes('DUPLICATE')
          ? 'duplicate'
          : status === 429
            ? 'rate_limit'
            : status >= 500
              ? 'server'
              : 'request',
  };
}

export async function writeAuditLog({
  request,
  env = {},
  identity = null,
  projectId = '',
  actorAccountId = '',
  action = '',
  targetType = '',
  targetId = '',
  metadata = {},
} = {}) {
  const db = env.DB;
  const safeAction = normalizeString(action, 120);
  if (!safeAction || !db?.prepare) return null;

  try {
    const record = {
      id: auditId(safeAction),
      projectId: normalizeString(projectId, 160) || null,
      actorAccountId: normalizeString(actorAccountId || identity?.ownerId || identity?.id || '', 160) || null,
      action: safeAction,
      targetType: normalizeString(targetType, 100),
      targetId: normalizeString(targetId, 200),
      ipHash: await auditHash(requestIp(request), env),
      userAgentHash: await auditHash(request?.headers?.get?.('User-Agent') || '', env),
      metadata: sanitizeAuditMetadata(metadata),
      createdAt: new Date().toISOString(),
    };

    await db.prepare(`
      INSERT INTO audit_logs (
        id, project_id, actor_account_id, action, target_type, target_id,
        ip, user_agent, metadata_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.id,
      record.projectId,
      record.actorAccountId,
      record.action,
      record.targetType,
      record.targetId,
      record.ipHash,
      record.userAgentHash,
      JSON.stringify(record.metadata),
      record.createdAt,
    ).run();

    return record;
  } catch (error) {
    console.warn('audit log write failed', {
      action: safeAction,
      code: normalizeString(error?.code || error?.name || 'AUDIT_WRITE_FAILED', 100),
    });
    return null;
  }
}
