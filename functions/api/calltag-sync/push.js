import {
  handleApiError,
  jsonResponse,
  optionsResponse,
  readJson,
} from '../_shared.js';
import { securePayloadHash } from './_digest.js';
import { assertSyncRequestSize } from './_guard.js';
import {
  CALLTAG_SYNC_METHODS,
  assertRateLimit,
  encryptRecord,
  normalizePushItems,
  phoneSearchHash,
  recordSecurityEvent,
  secureSyncSession,
} from './_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALLTAG_SYNC_METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, CALLTAG_SYNC_METHODS);
  }

  let session;
  try {
    assertSyncRequestSize(request);
    session = await secureSyncSession(request, env);
    await assertRateLimit(env.DB, env, session.ownerId, session.deviceHash, 'push', 30, 60);
    const body = await readJson(request);
    const items = normalizePushItems(body);
    const accepted = [];
    const conflicts = [];

    for (const item of items) {
      const encrypted = await encryptRecord(
        env,
        session.ownerId,
        item.entityType,
        item.entityId,
        item.version,
        item.payload,
      );
      const payloadHash = await securePayloadHash(
        env,
        session.ownerId,
        item.entityType,
        item.entityId,
        item.version,
        item.payload,
      );
      const phoneHash = item.deleted
        ? ''
        : await phoneSearchHash(env, session.ownerId, item.entityType, item.payload);
      const existing = await env.DB.prepare(`
        SELECT version, payload_hash, deleted_at
        FROM calltag_sync_records
        WHERE owner_id = ? AND entity_type = ? AND entity_id = ?
        LIMIT 1
      `).bind(session.ownerId, item.entityType, item.entityId).first();

      if (existing) {
        const existingVersion = Number(existing.version || 0);
        const idempotent = existingVersion === item.version
          && String(existing.payload_hash || '') === payloadHash
          && Boolean(existing.deleted_at) === item.deleted;
        if (idempotent) {
          accepted.push({
            entityType: item.entityType,
            entityId: item.entityId,
            version: item.version,
            idempotent: true,
          });
          continue;
        }
        if (existingVersion >= item.version) {
          conflicts.push({
            entityType: item.entityType,
            entityId: item.entityId,
            clientVersion: item.version,
            serverVersion: existingVersion,
            code: 'CALLTAG_SYNC_VERSION_CONFLICT',
          });
          continue;
        }
      }

      const deletedAt = item.deleted ? new Date().toISOString() : '';
      const result = await env.DB.prepare(`
        INSERT INTO calltag_sync_records (
          owner_id, entity_type, entity_id, version,
          ciphertext, iv, key_version, payload_hash, phone_search_hash,
          deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(owner_id, entity_type, entity_id) DO UPDATE SET
          version = excluded.version,
          ciphertext = excluded.ciphertext,
          iv = excluded.iv,
          key_version = excluded.key_version,
          payload_hash = excluded.payload_hash,
          phone_search_hash = excluded.phone_search_hash,
          deleted_at = excluded.deleted_at,
          updated_at = CURRENT_TIMESTAMP
        WHERE calltag_sync_records.version < excluded.version
      `).bind(
        session.ownerId,
        item.entityType,
        item.entityId,
        item.version,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.keyVersion,
        payloadHash,
        phoneHash,
        deletedAt,
      ).run();

      if (Number(result?.meta?.changes || 0) < 1) {
        const latest = await env.DB.prepare(`
          SELECT version FROM calltag_sync_records
          WHERE owner_id = ? AND entity_type = ? AND entity_id = ?
          LIMIT 1
        `).bind(session.ownerId, item.entityType, item.entityId).first();
        conflicts.push({
          entityType: item.entityType,
          entityId: item.entityId,
          clientVersion: item.version,
          serverVersion: Number(latest?.version || 0),
          code: 'CALLTAG_SYNC_VERSION_CONFLICT',
        });
        continue;
      }

      await env.DB.prepare(`
        INSERT INTO calltag_sync_changes (
          owner_id, entity_type, entity_id, version, action, created_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        session.ownerId,
        item.entityType,
        item.entityId,
        item.version,
        item.deleted ? 'delete' : 'upsert',
      ).run();
      accepted.push({
        entityType: item.entityType,
        entityId: item.entityId,
        version: item.version,
        deleted: item.deleted,
      });
    }

    await recordSecurityEvent(
      env.DB,
      env,
      session.ownerId,
      session.deviceHash,
      'sync_push',
      conflicts.length ? 'PARTIAL' : 'SUCCESS',
      { accepted: accepted.length, conflicts: conflicts.length },
    );

    return jsonResponse(request, env, 200, {
      ok: true,
      serverNow: new Date().toISOString(),
      accepted,
      conflicts,
    }, CALLTAG_SYNC_METHODS);
  } catch (error) {
    if (session?.ownerId) {
      await recordSecurityEvent(
        env.DB,
        env,
        session.ownerId,
        session.deviceHash,
        'sync_push',
        String(error?.details?.code || 'FAILED'),
      );
    }
    return handleApiError(request, env, error, CALLTAG_SYNC_METHODS);
  }
}
