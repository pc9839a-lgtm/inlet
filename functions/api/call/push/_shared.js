let cachedAccessToken = '';
let cachedAccessTokenExpiresAt = 0;

export async function ensurePushSchema(db) {
  if (!db?.prepare) throw pushError('푸시 저장소가 연결되지 않았습니다.', 503, 'PUSH_DB_REQUIRED');
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_push_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      token TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'android',
      app_version TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_success_at TEXT NOT NULL DEFAULT '',
      last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(owner_id, device_id),
      UNIQUE(token)
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_calltag_push_owner_enabled
    ON calltag_push_devices(owner_id, enabled, updated_at DESC)
  `).run();
}

export async function registerPushDevice(db, ownerId = '', input = {}) {
  await ensurePushSchema(db);
  const safeOwnerId = text(ownerId, 120);
  const deviceId = text(input.deviceId, 160);
  const token = text(input.token, 4096);
  if (!safeOwnerId) throw pushError('로그인이 필요합니다.', 401, 'PUSH_SESSION_REQUIRED');
  if (!deviceId || !token) throw pushError('기기 알림 정보가 없습니다.', 400, 'PUSH_DEVICE_REQUIRED');

  await db.prepare(`
    DELETE FROM calltag_push_devices
    WHERE token = ? AND (owner_id != ? OR device_id != ?)
  `).bind(token, safeOwnerId, deviceId).run();

  await db.prepare(`
    INSERT INTO calltag_push_devices (
      owner_id, device_id, token, platform, app_version, enabled,
      last_registered_at, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, 'android', ?, 1, CURRENT_TIMESTAMP, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id, device_id) DO UPDATE SET
      token = excluded.token,
      platform = 'android',
      app_version = excluded.app_version,
      enabled = 1,
      last_registered_at = CURRENT_TIMESTAMP,
      last_error = '',
      updated_at = CURRENT_TIMESTAMP
  `).bind(safeOwnerId, deviceId, token, text(input.appVersion, 40)).run();
  return pushStatus(db, safeOwnerId, deviceId, input.env || {});
}

export async function unregisterPushDevice(db, ownerId = '', input = {}) {
  await ensurePushSchema(db);
  const safeOwnerId = text(ownerId, 120);
  const deviceId = text(input.deviceId, 160);
  if (!safeOwnerId || !deviceId) return { removed: 0 };
  const result = await db.prepare(`
    UPDATE calltag_push_devices
    SET enabled = 0, updated_at = CURRENT_TIMESTAMP
    WHERE owner_id = ? AND device_id = ?
  `).bind(safeOwnerId, deviceId).run();
  return { removed: Number(result?.meta?.changes || 0) };
}

export async function pushStatus(db, ownerId = '', deviceId = '', env = {}) {
  await ensurePushSchema(db);
  const row = deviceId
    ? await db.prepare(`
        SELECT enabled, last_registered_at, last_success_at, last_error
        FROM calltag_push_devices
        WHERE owner_id = ? AND device_id = ?
        LIMIT 1
      `).bind(text(ownerId, 120), text(deviceId, 160)).first()
    : null;
  const configured = firebaseConfigured(env);
  return {
    configured,
    registered: !!row && Number(row.enabled || 0) === 1,
    realtime: configured && !!row && Number(row.enabled || 0) === 1,
    lastRegisteredAt: String(row?.last_registered_at || ''),
    lastSuccessAt: String(row?.last_success_at || ''),
    lastError: String(row?.last_error || ''),
    message: !configured
      ? 'Firebase 운영 설정이 필요합니다.'
      : row && Number(row.enabled || 0) === 1
        ? '실시간 문의 알림이 연결되었습니다.'
        : '이 기기의 실시간 문의 알림을 등록해야 합니다.',
  };
}

export async function ownerIdForProject(db, projectId = '') {
  if (!db?.prepare || !projectId) return '';
  const row = await db.prepare(`
    SELECT *
    FROM projects
    WHERE id = ?
    LIMIT 1
  `).bind(String(projectId)).first();
  return text(
    row?.owner_account_id
      || row?.owner_id
      || row?.ownerId
      || row?.account_id
      || row?.accountId,
    120
  );
}

export async function notifyPageroLeadAvailable(env = {}, db, ownerId = '', input = {}) {
  const safeOwnerId = text(ownerId, 120);
  if (!safeOwnerId || !firebaseConfigured(env)) {
    return { configured: firebaseConfigured(env), attempted: 0, sent: 0 };
  }
  await ensurePushSchema(db);
  const rows = await db.prepare(`
    SELECT id, token
    FROM calltag_push_devices
    WHERE owner_id = ? AND enabled = 1
    ORDER BY updated_at DESC
    LIMIT 20
  `).bind(safeOwnerId).all();
  const devices = Array.isArray(rows?.results) ? rows.results : [];
  if (!devices.length) return { configured: true, attempted: 0, sent: 0 };

  const accessToken = await firebaseAccessToken(env);
  let sent = 0;
  for (const device of devices) {
    try {
      await sendFirebaseMessage(env, accessToken, String(device.token || ''), {
        type: 'pagero_lead_available',
        eventId: text(input.eventId, 240),
        queueId: String(Number(input.queueId || 0)),
        sentAt: String(Date.now()),
      });
      sent++;
      await db.prepare(`
        UPDATE calltag_push_devices
        SET last_success_at = CURRENT_TIMESTAMP, last_error = '', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(device.id).run();
    } catch (error) {
      const code = String(error?.code || 'FCM_SEND_FAILED');
      const invalid = ['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND'].includes(code);
      await db.prepare(`
        UPDATE calltag_push_devices
        SET enabled = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(invalid ? 0 : 1, text(error?.message || code, 500), device.id).run();
    }
  }
  return { configured: true, attempted: devices.length, sent };
}

export function firebaseConfigured(env = {}) {
  return !!(
    text(env.FIREBASE_PROJECT_ID, 200)
    && text(env.FIREBASE_CLIENT_EMAIL, 300)
    && text(env.FIREBASE_PRIVATE_KEY, 12000)
  );
}

export function pushError(message, status = 400, code = 'PUSH_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.details = { code };
  return error;
}

async function sendFirebaseMessage(env, accessToken, token, data = {}) {
  const projectId = text(env.FIREBASE_PROJECT_ID, 200);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value ?? '')])),
        android: {
          collapse_key: 'pagero_lead_available',
          priority: 'HIGH',
          ttl: '300s',
          restricted_package_name: 'kr.pagero.calltag',
        },
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(body?.error?.details) ? body.error.details : [];
    const fcm = details.find((item) => item?.errorCode);
    const error = new Error(String(body?.error?.message || 'FCM 전송에 실패했습니다.'));
    error.code = String(fcm?.errorCode || body?.error?.status || 'FCM_SEND_FAILED');
    throw error;
  }
  return body;
}

async function firebaseAccessToken(env = {}) {
  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + 60000) return cachedAccessToken;
  const assertion = await firebaseJwt(env);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw pushError('Firebase 인증에 실패했습니다.', 503, 'FCM_AUTH_FAILED');
  }
  cachedAccessToken = String(body.access_token);
  cachedAccessTokenExpiresAt = Date.now() + Math.max(60, Number(body.expires_in || 3600)) * 1000;
  return cachedAccessToken;
}

async function firebaseJwt(env = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const payload = base64UrlJson({
    iss: text(env.FIREBASE_CLIENT_EMAIL, 300),
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const unsigned = `${header}.${payload}`;
  const key = await importPrivateKey(String(env.FIREBASE_PRIVATE_KEY || ''));
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function importPrivateKey(value = '') {
  const pem = String(value || '').replace(/\\n/g, '\n');
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function base64UrlJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}
