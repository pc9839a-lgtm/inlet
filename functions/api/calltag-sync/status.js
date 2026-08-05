import {
  handleApiError,
  jsonResponse,
  optionsResponse,
} from '../_shared.js';
import {
  CALLTAG_SYNC_METHODS,
  assertRateLimit,
  maxOwnerCursor,
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
    await assertRateLimit(env.DB, env, session.ownerId, session.deviceHash, 'status', 60, 60);
    const countRow = await env.DB.prepare(`
      SELECT
        COUNT(*) AS record_count,
        SUM(CASE WHEN deleted_at = '' THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN deleted_at != '' THEN 1 ELSE 0 END) AS deleted_count,
        MAX(updated_at) AS last_updated_at
      FROM calltag_sync_records
      WHERE owner_id = ?
    `).bind(session.ownerId).first();
    const deviceRow = await env.DB.prepare(`
      SELECT COUNT(*) AS device_count
      FROM calltag_sync_devices
      WHERE owner_id = ? AND revoked_at = ''
    `).bind(session.ownerId).first();
    const cursor = await maxOwnerCursor(env.DB, session.ownerId);

    await recordSecurityEvent(
      env.DB,
      env,
      session.ownerId,
      session.deviceHash,
      'sync_status',
      'SUCCESS',
    );
    return jsonResponse(request, env, 200, {
      ok: true,
      serverNow: new Date().toISOString(),
      sync: {
        enabled: true,
        encrypted: true,
        keyVersion: 1,
        cursor,
        recordCount: Number(countRow?.record_count || 0),
        activeCount: Number(countRow?.active_count || 0),
        deletedCount: Number(countRow?.deleted_count || 0),
        activeDeviceCount: Number(deviceRow?.device_count || 0),
        lastUpdatedAt: String(countRow?.last_updated_at || ''),
      },
    }, CALLTAG_SYNC_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALLTAG_SYNC_METHODS);
  }
}
