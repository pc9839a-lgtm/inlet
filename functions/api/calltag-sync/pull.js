import {
  handleApiError,
  jsonResponse,
  optionsResponse,
} from '../_shared.js';
import {
  CALLTAG_SYNC_METHODS,
  assertRateLimit,
  decryptRecord,
  pullCursor,
  pullLimit,
  recordSecurityEvent,
  secureSyncSession,
} from './_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALLTAG_SYNC_METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, CALLTAG_SYNC_METHODS);
  }

  let session;
  try {
    session = await secureSyncSession(request, env);
    await assertRateLimit(env.DB, env, session.ownerId, session.deviceHash, 'pull', 60, 60);
    const url = new URL(request.url);
    const cursor = pullCursor(url);
    const limit = pullLimit(url);
    const result = await env.DB.prepare(`
      SELECT
        changes.id AS change_seq,
        changes.action AS change_action,
        records.owner_id,
        records.entity_type,
        records.entity_id,
        records.version,
        records.ciphertext,
        records.iv,
        records.key_version,
        records.payload_hash,
        records.deleted_at,
        records.updated_at
      FROM calltag_sync_changes AS changes
      INNER JOIN calltag_sync_records AS records
        ON records.owner_id = changes.owner_id
       AND records.entity_type = changes.entity_type
       AND records.entity_id = changes.entity_id
      WHERE changes.owner_id = ?
        AND changes.id > ?
      ORDER BY changes.id ASC
      LIMIT ?
    `).bind(session.ownerId, cursor, limit).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const latestByEntity = new Map();
    let nextCursor = cursor;
    for (const row of rows) {
      nextCursor = Math.max(nextCursor, Number(row.change_seq || 0));
      latestByEntity.set(`${row.entity_type}:${row.entity_id}`, row);
    }

    const items = [];
    for (const row of latestByEntity.values()) {
      const deleted = Boolean(row.deleted_at);
      items.push({
        changeSeq: Number(row.change_seq || 0),
        entityType: String(row.entity_type || ''),
        entityId: String(row.entity_id || ''),
        version: Number(row.version || 0),
        deleted,
        updatedAt: String(row.updated_at || ''),
        payload: deleted ? null : await decryptRecord(env, row),
      });
    }
    items.sort((left, right) => left.changeSeq - right.changeSeq);

    await recordSecurityEvent(
      env.DB,
      env,
      session.ownerId,
      session.deviceHash,
      'sync_pull',
      'SUCCESS',
      { cursor, nextCursor, returned: items.length },
    );
    return jsonResponse(request, env, 200, {
      ok: true,
      serverNow: new Date().toISOString(),
      cursor,
      nextCursor,
      hasMore: rows.length >= limit,
      items,
    }, CALLTAG_SYNC_METHODS);
  } catch (error) {
    if (session?.ownerId) {
      await recordSecurityEvent(
        env.DB,
        env,
        session.ownerId,
        session.deviceHash,
        'sync_pull',
        String(error?.details?.code || 'FAILED'),
      );
    }
    return handleApiError(request, env, error, CALLTAG_SYNC_METHODS);
  }
}
