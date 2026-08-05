import {
  handleApiError,
  jsonResponse,
  optionsResponse,
  readJson,
} from '../_shared.js';
import { assertSyncRequestSize } from './_guard.js';
import {
  assertRateLimit,
  recordSecurityEvent,
  secureSyncSession,
  syncError,
} from './_shared.js';

const METHODS = 'GET, POST, OPTIONS';
const DEVICE_KEY_PATTERN = /^[a-f0-9]{64}$/;

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, METHODS);
  }

  let session;
  try {
    assertSyncRequestSize(request, 8 * 1024);
    session = await secureSyncSession(request, env);

    if (request.method === 'GET') {
      await assertRateLimit(env.DB, env, session.ownerId, session.deviceHash, 'devices_list', 30, 60 * 60);
      const result = await env.DB.prepare(`
        SELECT
          device_hash,
          device_label,
          app_version,
          first_seen_at,
          last_seen_at,
          revoked_at
        FROM calltag_sync_devices
        WHERE owner_id = ?
        ORDER BY
          CASE WHEN device_hash = ? THEN 0 ELSE 1 END,
          last_seen_at DESC
        LIMIT 50
      `).bind(session.ownerId, session.deviceHash).all();

      const devices = (result?.results || []).map((row) => ({
        deviceKey: String(row.device_hash || ''),
        label: String(row.device_label || ''),
        appVersion: String(row.app_version || ''),
        firstSeenAt: String(row.first_seen_at || ''),
        lastSeenAt: String(row.last_seen_at || ''),
        revokedAt: String(row.revoked_at || ''),
        current: String(row.device_hash || '') === session.deviceHash,
        active: !row.revoked_at,
      }));

      await recordSecurityEvent(
        env.DB,
        env,
        session.ownerId,
        session.deviceHash,
        'sync_devices_list',
        'SUCCESS',
        { count: devices.length },
      );
      return jsonResponse(request, env, 200, {
        ok: true,
        serverNow: new Date().toISOString(),
        devices,
      }, METHODS);
    }

    await assertRateLimit(env.DB, env, session.ownerId, session.deviceHash, 'device_revoke', 5, 60 * 60);
    const body = await readJson(request);
    const deviceKey = String(body.deviceKey || '').trim().toLowerCase();
    if (!DEVICE_KEY_PATTERN.test(deviceKey)) {
      throw syncError('해제할 기기 정보가 올바르지 않습니다.', 400, 'CALLTAG_SYNC_DEVICE_KEY_INVALID');
    }
    if (deviceKey === session.deviceHash) {
      throw syncError(
        '현재 기기는 이 화면에서 해제할 수 없습니다. 로그아웃 또는 계정 설정을 이용해주세요.',
        409,
        'CALLTAG_SYNC_CURRENT_DEVICE_REVOKE_BLOCKED',
      );
    }
    if (String(body.confirmation || '') !== 'REVOKE_CALLTAG_SYNC_DEVICE') {
      throw syncError(
        '기기 해제 확인값이 필요합니다.',
        400,
        'CALLTAG_SYNC_DEVICE_REVOKE_CONFIRMATION_REQUIRED',
      );
    }

    const result = await env.DB.prepare(`
      UPDATE calltag_sync_devices
      SET revoked_at = CURRENT_TIMESTAMP,
          last_seen_at = CURRENT_TIMESTAMP
      WHERE owner_id = ?
        AND device_hash = ?
        AND revoked_at = ''
    `).bind(session.ownerId, deviceKey).run();
    if (Number(result?.meta?.changes || 0) < 1) {
      throw syncError('활성 상태인 대상 기기를 찾지 못했습니다.', 404, 'CALLTAG_SYNC_DEVICE_NOT_FOUND');
    }

    await recordSecurityEvent(
      env.DB,
      env,
      session.ownerId,
      session.deviceHash,
      'sync_device_revoke',
      'SUCCESS',
    );
    return jsonResponse(request, env, 200, {
      ok: true,
      serverNow: new Date().toISOString(),
      revoked: true,
      deviceKey,
    }, METHODS);
  } catch (error) {
    if (session?.ownerId) {
      await recordSecurityEvent(
        env.DB,
        env,
        session.ownerId,
        session.deviceHash,
        'sync_device_management',
        String(error?.details?.code || 'FAILED'),
      );
    }
    return handleApiError(request, env, error, METHODS);
  }
}
