import { callSession } from '../call/_shared.js';

export const CALLTAG_SYNC_METHODS = 'GET, POST, DELETE, OPTIONS';
export const SYNC_ENTITY_TYPES = Object.freeze([
  'customer',
  'interaction',
  'task',
  'stage',
  'template',
  'automation',
]);

const ENTITY_FIELDS = Object.freeze({
  customer: [
    'displayName', 'primaryPhone', 'relationStatus', 'source', 'memo',
    'firstContactAt', 'lastContactAt', 'createdAt', 'updatedAt',
  ],
  interaction: [
    'customerId', 'opportunityId', 'type', 'startedAt', 'endedAt',
    'durationSec', 'result', 'note', 'createdAt', 'updatedAt',
  ],
  task: [
    'customerId', 'opportunityId', 'interactionId', 'taskType', 'title',
    'dueAt', 'status', 'completedAt', 'createdAt', 'updatedAt',
  ],
  stage: ['name', 'position', 'color', 'createdAt', 'updatedAt'],
  template: ['name', 'body', 'purpose', 'hasImage', 'createdAt', 'updatedAt'],
  automation: [
    'enabled', 'connectedEnabled', 'missedEnabled', 'delayedEnabled',
    'delayDays', 'cooldownHours', 'businessHoursEnabled', 'startHour',
    'endHour', 'updatedAt',
  ],
});

const MAX_RECORDS_PER_PUSH = 100;
const MAX_PULL_LIMIT = 100;
const MAX_ENTITY_ID_LENGTH = 120;
const MAX_STRING_LENGTH = 8_000;
const MAX_SERIALIZED_PAYLOAD_BYTES = 64 * 1024;
const KEY_VERSION = 1;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function syncError(message, status = 400, code = 'CALLTAG_SYNC_ERROR', extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = { code, ...extra };
  return error;
}

export function assertSecureSyncReady(env = {}) {
  const enabled = String(env.CALLTAG_SECURE_SYNC_ENABLED || '0').trim() === '1';
  if (!enabled) {
    throw syncError('안전한 데이터 동기화 기능을 준비 중입니다.', 503, 'CALLTAG_SYNC_NOT_ENABLED');
  }
  decodeKeyMaterial(env.CALLTAG_DATA_ENCRYPTION_KEY, 'CALLTAG_DATA_ENCRYPTION_KEY');
  decodeKeyMaterial(env.CALLTAG_DATA_SEARCH_KEY, 'CALLTAG_DATA_SEARCH_KEY');
}

export async function secureSyncSession(request, env, input = {}) {
  assertSecureSyncReady(env);
  const session = await callSession(request, env, input);
  const deviceHash = await deviceHashFromRequest(request, env, session.ownerId);
  await ensureSecureSyncSchema(env.DB);
  await registerDevice(env.DB, session.ownerId, deviceHash, request);
  return { ...session, deviceHash };
}

export async function ensureSecureSyncSchema(db) {
  if (!db?.prepare) throw syncError('서버 데이터베이스 연결이 준비되지 않았습니다.', 503, 'CALLTAG_SYNC_DB_REQUIRED');
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_sync_devices (
      owner_id TEXT NOT NULL,
      device_hash TEXT NOT NULL,
      device_label TEXT NOT NULL DEFAULT '',
      app_version TEXT NOT NULL DEFAULT '',
      first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (owner_id, device_hash)
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_sync_records (
      owner_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      ciphertext TEXT NOT NULL,
      iv TEXT NOT NULL,
      key_version INTEGER NOT NULL DEFAULT 1,
      payload_hash TEXT NOT NULL,
      phone_search_hash TEXT NOT NULL DEFAULT '',
      deleted_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (owner_id, entity_type, entity_id)
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_sync_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_sync_rate_limits (
      rate_key TEXT NOT NULL,
      window_started_at INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (rate_key, window_started_at)
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_hash TEXT NOT NULL DEFAULT '',
      device_hash TEXT NOT NULL DEFAULT '',
      event_type TEXT NOT NULL,
      result_code TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_calltag_sync_changes_owner_cursor ON calltag_sync_changes(owner_id, id ASC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_calltag_sync_records_owner_updated ON calltag_sync_records(owner_id, updated_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_calltag_sync_records_owner_phone ON calltag_sync_records(owner_id, entity_type, phone_search_hash)`).run();
}

export function normalizeEntityType(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return SYNC_ENTITY_TYPES.includes(normalized) ? normalized : '';
}

export function normalizeEntityId(value = '') {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > MAX_ENTITY_ID_LENGTH || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw syncError('동기화 항목 식별자가 올바르지 않습니다.', 400, 'CALLTAG_SYNC_ENTITY_ID_INVALID');
  }
  return normalized;
}

export function normalizeVersion(value) {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1 || version > 2_147_483_647) {
    throw syncError('동기화 버전이 올바르지 않습니다.', 400, 'CALLTAG_SYNC_VERSION_INVALID');
  }
  return version;
}

export function sanitizeSyncPayload(entityType, input) {
  const type = normalizeEntityType(entityType);
  if (!type) throw syncError('지원하지 않는 동기화 항목입니다.', 400, 'CALLTAG_SYNC_ENTITY_TYPE_INVALID');
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw syncError('동기화 데이터 형식이 올바르지 않습니다.', 400, 'CALLTAG_SYNC_PAYLOAD_INVALID');
  }
  const result = {};
  for (const field of ENTITY_FIELDS[type]) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    const value = input[field];
    if (typeof value === 'string') result[field] = value.trim().slice(0, MAX_STRING_LENGTH);
    else if (typeof value === 'number' && Number.isFinite(value)) result[field] = value;
    else if (typeof value === 'boolean') result[field] = value;
    else if (value === null) result[field] = null;
  }
  const serialized = JSON.stringify(result);
  if (textEncoder.encode(serialized).byteLength > MAX_SERIALIZED_PAYLOAD_BYTES) {
    throw syncError('동기화 항목의 크기가 너무 큽니다.', 413, 'CALLTAG_SYNC_PAYLOAD_TOO_LARGE');
  }
  return result;
}

export function normalizePushItems(body = {}) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length || items.length > MAX_RECORDS_PER_PUSH) {
    throw syncError('한 번에 1개 이상 100개 이하의 항목만 동기화할 수 있습니다.', 400, 'CALLTAG_SYNC_BATCH_SIZE_INVALID');
  }
  return items.map((item) => {
    const entityType = normalizeEntityType(item?.entityType);
    if (!entityType) throw syncError('지원하지 않는 동기화 항목입니다.', 400, 'CALLTAG_SYNC_ENTITY_TYPE_INVALID');
    const entityId = normalizeEntityId(item?.entityId);
    const version = normalizeVersion(item?.version);
    const deleted = item?.deleted === true;
    const payload = deleted ? {} : sanitizeSyncPayload(entityType, item?.payload);
    return { entityType, entityId, version, deleted, payload };
  });
}

export function pullCursor(url) {
  const value = Number(url.searchParams.get('cursor') || 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function pullLimit(url) {
  const value = Number(url.searchParams.get('limit') || MAX_PULL_LIMIT);
  if (!Number.isFinite(value)) return MAX_PULL_LIMIT;
  return Math.max(1, Math.min(MAX_PULL_LIMIT, Math.floor(value)));
}

export async function encryptRecord(env, ownerId, entityType, entityId, version, payload) {
  const key = await importAesKey(env.CALLTAG_DATA_ENCRYPTION_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify(payload));
  const additionalData = textEncoder.encode(aad(ownerId, entityType, entityId, version));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData, tagLength: 128 },
    key,
    plaintext,
  ));
  return {
    ciphertext: bytesToBase64(ciphertext),
    iv: bytesToBase64(iv),
    keyVersion: KEY_VERSION,
    payloadHash: await sha256Hex(plaintext),
  };
}

export async function decryptRecord(env, row) {
  const key = await importAesKey(env.CALLTAG_DATA_ENCRYPTION_KEY);
  const iv = base64ToBytes(String(row.iv || ''));
  const ciphertext = base64ToBytes(String(row.ciphertext || ''));
  const additionalData = textEncoder.encode(aad(
    row.owner_id,
    row.entity_type,
    row.entity_id,
    Number(row.version),
  ));
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData, tagLength: 128 },
      key,
      ciphertext,
    );
    return JSON.parse(textDecoder.decode(plaintext));
  } catch {
    throw syncError('암호화된 동기화 데이터를 확인하지 못했습니다.', 500, 'CALLTAG_SYNC_DECRYPT_FAILED');
  }
}

export async function phoneSearchHash(env, ownerId, entityType, payload = {}) {
  if (entityType !== 'customer') return '';
  const phone = normalizePhone(payload.primaryPhone);
  if (!phone) return '';
  return hmacHex(`phone:v1:${ownerId}:${phone}`, env.CALLTAG_DATA_SEARCH_KEY);
}

export async function ownerSecurityHash(env, ownerId) {
  return (await hmacHex(`owner:v1:${ownerId}`, env.CALLTAG_DATA_SEARCH_KEY)).slice(0, 32);
}

export async function assertRateLimit(db, env, ownerId, deviceHash, action, limit, windowSeconds) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStartedAt = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
  const rateKey = await hmacHex(
    `rate:v1:${ownerId}:${deviceHash}:${action}`,
    env.CALLTAG_DATA_SEARCH_KEY,
  );
  const row = await db.prepare(`
    INSERT INTO calltag_sync_rate_limits (
      rate_key, window_started_at, request_count, updated_at
    ) VALUES (?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(rate_key, window_started_at) DO UPDATE SET
      request_count = calltag_sync_rate_limits.request_count + 1,
      updated_at = CURRENT_TIMESTAMP
    RETURNING request_count
  `).bind(rateKey, windowStartedAt).first();
  const count = Number(row?.request_count || 0);
  if (count > limit) {
    await recordSecurityEvent(db, env, ownerId, deviceHash, 'rate_limit', 'BLOCKED', { action });
    throw syncError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429, 'CALLTAG_SYNC_RATE_LIMITED', {
      retryAfterSeconds: Math.max(1, windowStartedAt + windowSeconds - nowSeconds),
    });
  }
}

export async function recordSecurityEvent(db, env, ownerId, deviceHash, eventType, resultCode, metadata = {}) {
  try {
    const ownerHash = ownerId ? await ownerSecurityHash(env, ownerId) : '';
    const safeMetadata = {};
    for (const [key, value] of Object.entries(metadata || {})) {
      if (!/^[a-zA-Z0-9_]{1,40}$/.test(key)) continue;
      if (typeof value === 'number' && Number.isFinite(value)) safeMetadata[key] = value;
      else if (typeof value === 'boolean') safeMetadata[key] = value;
      else if (typeof value === 'string') safeMetadata[key] = value.slice(0, 120);
    }
    await db.prepare(`
      INSERT INTO calltag_security_events (
        owner_hash, device_hash, event_type, result_code, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      ownerHash,
      String(deviceHash || '').slice(0, 64),
      String(eventType || '').slice(0, 80),
      String(resultCode || '').slice(0, 80),
      JSON.stringify(safeMetadata),
    ).run();
  } catch {
    // Security logging must never expose or block customer data operations.
  }
}

export async function assertDeviceActive(db, ownerId, deviceHash) {
  const row = await db.prepare(`
    SELECT revoked_at
    FROM calltag_sync_devices
    WHERE owner_id = ? AND device_hash = ?
    LIMIT 1
  `).bind(ownerId, deviceHash).first();
  if (row?.revoked_at) {
    throw syncError('이 기기의 동기화 권한이 해제되었습니다.', 403, 'CALLTAG_SYNC_DEVICE_REVOKED');
  }
}

export async function maxOwnerCursor(db, ownerId) {
  const row = await db.prepare(`
    SELECT COALESCE(MAX(id), 0) AS cursor
    FROM calltag_sync_changes
    WHERE owner_id = ?
  `).bind(ownerId).first();
  return Number(row?.cursor || 0);
}

async function registerDevice(db, ownerId, deviceHash, request) {
  const label = String(request.headers.get('X-CallTag-Device-Label') || '').trim().slice(0, 80);
  const appVersion = String(request.headers.get('X-CallTag-App-Version') || '').trim().slice(0, 40);
  await db.prepare(`
    INSERT INTO calltag_sync_devices (
      owner_id, device_hash, device_label, app_version,
      first_seen_at, last_seen_at, revoked_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '')
    ON CONFLICT(owner_id, device_hash) DO UPDATE SET
      device_label = CASE WHEN excluded.device_label = '' THEN calltag_sync_devices.device_label ELSE excluded.device_label END,
      app_version = CASE WHEN excluded.app_version = '' THEN calltag_sync_devices.app_version ELSE excluded.app_version END,
      last_seen_at = CURRENT_TIMESTAMP
  `).bind(ownerId, deviceHash, label, appVersion).run();
  await assertDeviceActive(db, ownerId, deviceHash);
}

async function deviceHashFromRequest(request, env, ownerId) {
  const raw = String(request.headers.get('X-CallTag-Device') || '').trim();
  if (raw.length < 16 || raw.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(raw)) {
    throw syncError('기기 식별정보가 필요합니다.', 400, 'CALLTAG_SYNC_DEVICE_REQUIRED');
  }
  return hmacHex(`device:v1:${ownerId}:${raw}`, env.CALLTAG_DATA_SEARCH_KEY);
}

function aad(ownerId, entityType, entityId, version) {
  return `calltag-sync:v1:${ownerId}:${entityType}:${entityId}:${version}`;
}

function normalizePhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('82') && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits.slice(0, 20);
}

async function importAesKey(value) {
  const bytes = decodeKeyMaterial(value, 'CALLTAG_DATA_ENCRYPTION_KEY');
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function decodeKeyMaterial(value, name) {
  const text = String(value || '').trim();
  let bytes;
  if (/^[a-fA-F0-9]{64}$/.test(text)) {
    bytes = new Uint8Array(text.match(/.{2}/g).map((part) => parseInt(part, 16)));
  } else {
    try {
      bytes = base64ToBytes(text);
    } catch {
      bytes = new Uint8Array();
    }
  }
  if (bytes.length !== 32) {
    throw syncError(`${name} 설정이 올바르지 않습니다.`, 503, 'CALLTAG_SYNC_KEY_INVALID');
  }
  return bytes;
}

async function hmacHex(message, secretValue) {
  const secret = decodeKeyMaterial(secretValue, 'CALLTAG_DATA_SEARCH_KEY');
  const key = await crypto.subtle.importKey(
    'raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, textEncoder.encode(String(message || '')));
  return bytesToHex(new Uint8Array(digest));
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
