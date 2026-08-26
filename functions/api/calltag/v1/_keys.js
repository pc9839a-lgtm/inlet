import { ensureUniversalLeadSchema } from './_schema.js';
import { leadError, randomToken, safeOwner, sha256, text } from './_utils.js';

export async function authenticateLeadApiKey(request, db) {
  await ensureUniversalLeadSchema(db);
  const auth = text(request.headers.get('Authorization'), 4096);
  const rawKey = /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  if (!rawKey || !rawKey.startsWith('ctk_')) {
    throw leadError('API key is required.', 401, 'CALLTAG_API_KEY_REQUIRED');
  }

  const keyHash = await sha256(rawKey);
  const row = await db.prepare(`
    SELECT id, owner_id, connection_id, name, key_prefix, status, last_used_at, created_at
    FROM calltag_api_keys
    WHERE key_hash = ? AND status = 'active'
    LIMIT 1
  `).bind(keyHash).first();
  if (!row?.owner_id || !row?.connection_id) {
    throw leadError('API key is invalid or revoked.', 401, 'CALLTAG_API_KEY_INVALID');
  }

  await db.prepare(`UPDATE calltag_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(row.id).run();
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    connectionId: String(row.connection_id),
    name: String(row.name || ''),
    keyPrefix: String(row.key_prefix || ''),
  };
}

export async function listLeadApiKeys(db, ownerId = '') {
  await ensureUniversalLeadSchema(db);
  const rows = await db.prepare(`
    SELECT id, connection_id, name, key_prefix, status, last_used_at, created_at, revoked_at, rotated_from_id
    FROM calltag_api_keys
    WHERE owner_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(safeOwner(ownerId)).all();
  return (rows?.results || []).map(publicApiKey);
}

export async function createLeadApiKey(db, ownerId = '', input = {}) {
  await ensureUniversalLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const connectionId = text(input.connectionId, 160) || `ctconn_${randomToken(12)}`;
  const rawKey = `ctk_${randomToken(32)}`;
  const keyHash = await sha256(rawKey);
  const keyPrefix = rawKey.slice(0, 16);
  const id = `ctkey_${randomToken(12)}`;
  const name = text(input.name || 'External Lead API', 80);
  const rotatedFromId = text(input.rotatedFromId, 120);

  await db.prepare(`
    INSERT INTO calltag_api_keys (
      id, owner_id, connection_id, name, key_prefix, key_hash, status, rotated_from_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP)
  `).bind(id, safeOwnerId, connectionId, name, keyPrefix, keyHash, rotatedFromId).run();

  return {
    id,
    connectionId,
    name,
    keyPrefix,
    apiKey: rawKey,
    status: 'active',
    warning: '이 API Key는 지금 한 번만 표시됩니다. 안전한 곳에 저장하세요.',
  };
}

export async function revokeLeadApiKey(db, ownerId = '', keyId = '') {
  await ensureUniversalLeadSchema(db);
  const result = await db.prepare(`
    UPDATE calltag_api_keys
    SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_id = ? AND status = 'active'
  `).bind(text(keyId, 120), safeOwner(ownerId)).run();
  if (!Number(result?.meta?.changes || 0)) {
    throw leadError('API key was not found.', 404, 'CALLTAG_API_KEY_NOT_FOUND');
  }
  return { revoked: true, keyId: text(keyId, 120) };
}

export async function rotateLeadApiKey(db, ownerId = '', keyId = '', input = {}) {
  await ensureUniversalLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const existing = await db.prepare(`
    SELECT id, connection_id, name
    FROM calltag_api_keys
    WHERE id = ? AND owner_id = ? AND status = 'active'
    LIMIT 1
  `).bind(text(keyId, 120), safeOwnerId).first();
  if (!existing?.id || !existing?.connection_id) {
    throw leadError('API key was not found.', 404, 'CALLTAG_API_KEY_NOT_FOUND');
  }

  const created = await createLeadApiKey(db, safeOwnerId, {
    name: input.name || existing.name,
    connectionId: existing.connection_id,
    rotatedFromId: existing.id,
  });
  await revokeLeadApiKey(db, safeOwnerId, existing.id);
  return { ...created, rotatedFromId: String(existing.id) };
}

function publicApiKey(row = {}) {
  return {
    id: String(row.id || ''),
    connectionId: String(row.connection_id || ''),
    name: String(row.name || ''),
    keyPrefix: String(row.key_prefix || ''),
    status: String(row.status || ''),
    lastUsedAt: String(row.last_used_at || ''),
    createdAt: String(row.created_at || ''),
    revokedAt: String(row.revoked_at || ''),
    rotatedFromId: String(row.rotated_from_id || ''),
  };
}
