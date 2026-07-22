import {
  assertD1,
  handleApiError,
  jsonResponse,
  optionsResponse,
  readJson,
} from '../_shared.js';
import {
  codeHash,
  deviceTokenHash,
  isBillingActive,
  projectConnectionPayload,
  randomId,
} from './_shared.js';

const METHODS = 'POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const body = await readJson(request);
    const code = String(body.connectionCode || body.code || '').replace(/[^0-9]/g, '');
    const deviceKey = String(body.deviceKey || '').trim().slice(0, 160);
    const deviceName = String(body.deviceName || 'Android 기기').trim().slice(0, 80);
    const appVersion = String(body.appVersion || '').trim().slice(0, 30);
    if (code.length !== 6 || !deviceKey) {
      const error = new Error('CALLLINK_CONNECTION_INPUT_INVALID');
      error.status = 400;
      throw error;
    }

    const db = assertD1(env);
    const hash = await codeHash(code, env);
    const row = await db.prepare(`
      SELECT
        c.id AS code_id,
        c.project_id,
        c.created_by_account_id,
        c.expires_at,
        c.consumed_at,
        p.status AS project_status,
        p.billing_status,
        s.status AS subscription_status
      FROM calllink_connection_codes c
      INNER JOIN projects p ON p.id = c.project_id
      LEFT JOIN subscriptions s ON s.project_id = p.id
      WHERE c.code_hash = ?
      LIMIT 1
    `).bind(hash).first();
    if (!row || row.consumed_at || Date.parse(row.expires_at || '') <= Date.now()) {
      const error = new Error('CALLLINK_CONNECTION_CODE_INVALID');
      error.status = 400;
      throw error;
    }
    if (row.project_status !== 'active' || !isBillingActive(row)) {
      const error = new Error('CALLLINK_SUBSCRIPTION_INACTIVE');
      error.status = 402;
      throw error;
    }

    const consumedAt = new Date().toISOString();
    const consumeResult = await db.prepare(`
      UPDATE calllink_connection_codes
      SET consumed_at = ?
      WHERE id = ? AND consumed_at IS NULL
    `).bind(consumedAt, row.code_id).run();
    if (Number(consumeResult?.meta?.changes || 0) !== 1) {
      const error = new Error('CALLLINK_CONNECTION_CODE_ALREADY_USED');
      error.status = 409;
      throw error;
    }

    const deviceToken = randomId('cl');
    const tokenHash = await deviceTokenHash(deviceToken, env);
    const existing = await db.prepare(`
      SELECT id FROM calllink_devices
      WHERE project_id = ? AND device_key = ?
      LIMIT 1
    `).bind(row.project_id, deviceKey).first();
    const deviceId = existing?.id || randomId('cldev');
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(`
        INSERT INTO calllink_devices (
          id, project_id, account_id, token_hash, device_key, device_name,
          platform, app_version, status, last_seen_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'android', ?, 'active', ?, ?, ?)
        ON CONFLICT(project_id, device_key) DO UPDATE SET
          account_id = excluded.account_id,
          token_hash = excluded.token_hash,
          device_name = excluded.device_name,
          app_version = excluded.app_version,
          status = 'active',
          last_seen_at = excluded.last_seen_at,
          updated_at = excluded.updated_at
      `).bind(
        deviceId,
        row.project_id,
        row.created_by_account_id || null,
        tokenHash,
        deviceKey,
        deviceName,
        appVersion,
        now,
        now,
        now,
      ),
      db.prepare(`
        INSERT OR IGNORE INTO calllink_wallets (
          project_id, balance, currency, low_balance_threshold, created_at, updated_at
        ) VALUES (?, 0, 'KRW', 1000, ?, ?)
      `).bind(row.project_id, now, now),
    ]);

    const project = await projectConnectionPayload(db, row.project_id);
    return jsonResponse(request, env, 200, {
      ok: true,
      deviceToken,
      deviceId,
      project,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
