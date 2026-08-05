import {
  handleApiError,
  jsonResponse,
  optionsResponse,
  readJson,
} from '../_shared.js';
import {
  CALLTAG_SYNC_METHODS,
  assertRateLimit,
  recordSecurityEvent,
  secureSyncSession,
  syncError,
} from './_shared.js';

const CONFIRMATION = 'DELETE_CALLTAG_SYNC_DATA';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALLTAG_SYNC_METHODS);
  if (request.method !== 'DELETE' && request.method !== 'POST') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, CALLTAG_SYNC_METHODS);
  }

  let session;
  try {
    const body = await readJson(request);
    session = await secureSyncSession(request, env, body);
    await assertRateLimit(env.DB, env, session.ownerId, session.deviceHash, 'erase', 3, 60 * 60);
    if (String(body.confirmation || '') !== CONFIRMATION) {
      throw syncError('서버 데이터 삭제 확인값이 필요합니다.', 400, 'CALLTAG_SYNC_ERASE_CONFIRMATION_REQUIRED');
    }

    const records = await env.DB.prepare(`
      DELETE FROM calltag_sync_records WHERE owner_id = ?
    `).bind(session.ownerId).run();
    const changes = await env.DB.prepare(`
      DELETE FROM calltag_sync_changes WHERE owner_id = ?
    `).bind(session.ownerId).run();
    await env.DB.prepare(`
      UPDATE calltag_sync_devices
      SET revoked_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP
      WHERE owner_id = ?
    `).bind(session.ownerId).run();

    await recordSecurityEvent(
      env.DB,
      env,
      session.ownerId,
      session.deviceHash,
      'sync_erase',
      'SUCCESS',
      {
        records: Number(records?.meta?.changes || 0),
        changes: Number(changes?.meta?.changes || 0),
      },
    );
    return jsonResponse(request, env, 200, {
      ok: true,
      serverNow: new Date().toISOString(),
      erased: true,
      recordCount: Number(records?.meta?.changes || 0),
    }, CALLTAG_SYNC_METHODS);
  } catch (error) {
    if (session?.ownerId) {
      await recordSecurityEvent(
        env.DB,
        env,
        session.ownerId,
        session.deviceHash,
        'sync_erase',
        String(error?.details?.code || 'FAILED'),
      );
    }
    return handleApiError(request, env, error, CALLTAG_SYNC_METHODS);
  }
}
