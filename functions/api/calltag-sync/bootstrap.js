import {
  handleApiError,
  jsonResponse,
  optionsResponse,
} from '../_shared.js';
import {
  assertRateLimit,
  decryptRecord,
  maxOwnerCursor,
  normalizeEntityId,
  normalizeEntityType,
  pullLimit,
  recordSecurityEvent,
  secureSyncSession,
  syncError,
} from './_shared.js';

const METHODS = 'GET, OPTIONS';

function afterPosition(url) {
  const rawType = String(url.searchParams.get('afterType') || '').trim().toLowerCase();
  const rawId = String(url.searchParams.get('afterId') || '').trim();
  if (!rawType && !rawId) return { entityType: '', entityId: '' };
  const entityType = normalizeEntityType(rawType);
  if (!entityType) {
    throw syncError('복구 시작 위치의 항목 종류가 올바르지 않습니다.', 400, 'CALLTAG_SYNC_BOOTSTRAP_POSITION_INVALID');
  }
  const entityId = normalizeEntityId(rawId);
  return { entityType, entityId };
}

function requestedSnapshotCursor(url) {
  const raw = String(url.searchParams.get('snapshotCursor') || '').trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw syncError('복구 기준 cursor가 올바르지 않습니다.', 400, 'CALLTAG_SYNC_BOOTSTRAP_CURSOR_INVALID');
  }
  return value;
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, METHODS);
  }

  let session;
  try {
    session = await secureSyncSession(request, env);
    await assertRateLimit(env.DB, env, session.ownerId, session.deviceHash, 'bootstrap', 20, 60 * 60);

    const url = new URL(request.url);
    const position = afterPosition(url);
    const limit = pullLimit(url);
    const requestedCursor = requestedSnapshotCursor(url);
    const snapshotCursor = requestedCursor == null
      ? await maxOwnerCursor(env.DB, session.ownerId)
      : requestedCursor;

    const result = await env.DB.prepare(`
      SELECT
        owner_id,
        entity_type,
        entity_id,
        version,
        ciphertext,
        iv,
        key_version,
        deleted_at,
        updated_at
      FROM calltag_sync_records
      WHERE owner_id = ?
        AND (
          ? = ''
          OR entity_type > ?
          OR (entity_type = ? AND entity_id > ?)
        )
      ORDER BY entity_type ASC, entity_id ASC
      LIMIT ?
    `).bind(
      session.ownerId,
      position.entityType,
      position.entityType,
      position.entityType,
      position.entityId,
      limit + 1,
    ).all();

    const rows = result?.results || [];
    const pageRows = rows.slice(0, limit);
    const items = [];
    for (const row of pageRows) {
      const deleted = Boolean(row.deleted_at);
      items.push({
        entityType: String(row.entity_type || ''),
        entityId: String(row.entity_id || ''),
        version: Number(row.version || 0),
        deleted,
        payload: deleted ? null : await decryptRecord(env, row),
        updatedAt: String(row.updated_at || ''),
      });
    }

    const last = pageRows[pageRows.length - 1] || null;
    const complete = rows.length <= limit;
    const nextAfter = complete || !last
      ? null
      : {
          entityType: String(last.entity_type || ''),
          entityId: String(last.entity_id || ''),
        };

    await recordSecurityEvent(
      env.DB,
      env,
      session.ownerId,
      session.deviceHash,
      'sync_bootstrap',
      'SUCCESS',
      { count: items.length, complete },
    );
    return jsonResponse(request, env, 200, {
      ok: true,
      serverNow: new Date().toISOString(),
      snapshotCursor,
      items,
      nextAfter,
      complete,
      followUp: complete
        ? { endpoint: '/api/calltag-sync/pull', cursor: snapshotCursor }
        : null,
    }, METHODS);
  } catch (error) {
    if (session?.ownerId) {
      await recordSecurityEvent(
        env.DB,
        env,
        session.ownerId,
        session.deviceHash,
        'sync_bootstrap',
        String(error?.details?.code || 'FAILED'),
      );
    }
    return handleApiError(request, env, error, METHODS);
  }
}
