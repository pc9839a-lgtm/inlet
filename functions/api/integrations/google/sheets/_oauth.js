const GOOGLE_SHEETS_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

export const GOOGLE_SHEETS_COLUMNS = [
  '접수일시',
  '이름',
  '연락처',
  '이메일',
  '메시지',
  '페이지명',
  '페이지 URL',
  'UTM Source',
  'UTM Medium',
  'UTM Campaign',
];

export function googleClientId(env = {}) {
  return String(env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_CLIENT_ID || '').trim();
}

export function googleClientSecret(env = {}) {
  return String(env.GOOGLE_OAUTH_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || '').trim();
}

export function googleRedirectUri(request, env = {}) {
  const configured = String(env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();
  if (configured) return configured;
  return new URL('/api/integrations/google/sheets/callback', request.url).toString();
}

export async function signedOAuthState(payload = {}, env = {}) {
  const body = base64UrlEncode(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  }));
  return `${body}.${await hmacBase64Url(body, oauthSecret(env))}`;
}

export async function verifyOAuthState(state = '', env = {}) {
  const [body, signature] = String(state || '').split('.');
  if (!body || !signature) return null;
  const expected = await hmacBase64Url(body, oauthSecret(env));
  if (signature !== expected) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function googleSheetsAuthUrl({ clientId, redirectUri, state } = {}) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SHEETS_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeGoogleOAuthCode({ code, clientId, clientSecret, redirectUri } = {}) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('Google 계정 연결에 실패했습니다.');
    error.status = 502;
    error.details = data;
    throw error;
  }
  return data;
}

export async function fetchGoogleProfile(accessToken = '') {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return {};
  return data;
}

export async function createGoogleSpreadsheet(accessToken = '', input = {}) {
  const title = String(input.title || 'Pagero 접수함').trim() || 'Pagero 접수함';
  const sheetName = String(input.sheetName || '접수함').trim() || '접수함';
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: sheetName } }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.spreadsheetId) {
    const error = new Error('Google Sheets 파일 생성에 실패했습니다.');
    error.status = 502;
    error.details = data;
    throw error;
  }
  return data;
}

export async function saveGoogleSheetsIntegration(db, input = {}) {
  const projectId = String(input.projectId || '').trim();
  if (!db?.prepare || !projectId) return false;
  const now = new Date().toISOString();
  const id = `google_sheets_${projectId}`;
  await db.prepare(`
    INSERT INTO project_integrations (
      id, project_id, provider, mode, status, connected_email, external_id,
      settings_json, token_json, last_sync_at, last_error, created_at, updated_at
    )
    VALUES (?, ?, 'google_sheets', 'oauth', 'connected', ?, ?, ?, ?, ?, '', ?, ?)
    ON CONFLICT(project_id, provider) DO UPDATE SET
      mode = 'oauth',
      status = 'connected',
      connected_email = excluded.connected_email,
      external_id = excluded.external_id,
      settings_json = excluded.settings_json,
      token_json = excluded.token_json,
      last_sync_at = excluded.last_sync_at,
      last_error = '',
      updated_at = excluded.updated_at
  `).bind(
    id,
    projectId,
    String(input.connectedEmail || '').trim().toLowerCase(),
    String(input.externalId || '').trim(),
    JSON.stringify(input.settings || {}),
    JSON.stringify(input.tokens || {}),
    now,
    now,
    now,
  ).run();
  return true;
}

export async function getGoogleSheetsIntegration(db, projectId = '') {
  const id = String(projectId || '').trim();
  if (!db?.prepare || !id) return null;
  const row = await db.prepare(`
    SELECT project_id, provider, mode, status, connected_email, external_id,
      settings_json, token_json, last_sync_at, last_error
    FROM project_integrations
    WHERE project_id = ? AND provider = 'google_sheets'
    LIMIT 1
  `).bind(id).first();
  if (!row) return null;
  return {
    projectId: row.project_id || '',
    provider: row.provider || 'google_sheets',
    mode: row.mode || 'oauth',
    status: row.status || 'disconnected',
    connectedEmail: row.connected_email || '',
    externalId: row.external_id || '',
    settings: parseJson(row.settings_json, {}),
    tokens: parseJson(row.token_json, {}),
    lastSyncAt: row.last_sync_at || '',
    lastError: row.last_error || '',
  };
}

export async function deleteGoogleSheetsIntegration(db, projectId = '') {
  const id = String(projectId || '').trim();
  if (!db?.prepare || !id) return false;
  await db.prepare(`
    DELETE FROM project_integrations
    WHERE project_id = ? AND provider = 'google_sheets'
  `).bind(id).run();
  return true;
}

export async function updateGoogleSheetsIntegrationStatus(db, projectId = '', patch = {}) {
  const id = String(projectId || '').trim();
  if (!db?.prepare || !id) return false;
  const sets = [];
  const values = [];
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    sets.push('status = ?');
    values.push(String(patch.status || 'connected'));
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'lastSyncAt')) {
    sets.push('last_sync_at = ?');
    values.push(String(patch.lastSyncAt || ''));
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'lastError')) {
    sets.push('last_error = ?');
    values.push(String(patch.lastError || ''));
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'tokens')) {
    sets.push('token_json = ?');
    values.push(JSON.stringify(patch.tokens || {}));
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'settings')) {
    sets.push('settings_json = ?');
    values.push(JSON.stringify(patch.settings || {}));
  }
  if (!sets.length) return true;
  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  await db.prepare(`
    UPDATE project_integrations
    SET ${sets.join(', ')}
    WHERE project_id = ? AND provider = 'google_sheets'
  `).bind(...values).run();
  return true;
}

export async function refreshGoogleAccessToken({ refreshToken, clientId, clientSecret } = {}) {
  const body = new URLSearchParams({
    refresh_token: String(refreshToken || ''),
    client_id: String(clientId || ''),
    client_secret: String(clientSecret || ''),
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const error = new Error('Google access token refresh failed.');
    error.status = 502;
    error.details = data;
    throw error;
  }
  return data;
}

export async function appendGoogleSheetRow({ accessToken, spreadsheetId, sheetName, row } = {}) {
  const id = String(spreadsheetId || '').trim();
  const tab = String(sheetName || '접수함').trim() || '접수함';
  if (!id) {
    const error = new Error('Google Sheets 파일이 선택되지 않았습니다.');
    error.status = 400;
    throw error;
  }
  const range = encodeURIComponent(`${tab}!A:${columnName(Math.max(Array.isArray(row) ? row.length : 1, 1))}`);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [row] }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Google Sheets append failed: ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

export async function initializeGoogleSheetColumns({ accessToken, spreadsheetId, sheetName } = {}) {
  return ensureGoogleSheetHeaders({
    accessToken,
    spreadsheetId,
    sheetName,
    headers: GOOGLE_SHEETS_COLUMNS,
  });
}

export async function appendGoogleSheetPayload({ accessToken, spreadsheetId, sheetName, payload } = {}) {
  const table = googleSheetsPayloadTable(payload || {});
  const headers = await ensureGoogleSheetHeaders({
    accessToken,
    spreadsheetId,
    sheetName,
    headers: table.headers,
  });
  const values = table.valuesByHeader || {};
  return appendGoogleSheetRow({
    accessToken,
    spreadsheetId,
    sheetName,
    row: headers.map((header) => values[header] ?? ''),
  });
}

export async function ensureGoogleSheetHeaders({ accessToken, spreadsheetId, sheetName, headers } = {}) {
  const id = String(spreadsheetId || '').trim();
  const tab = String(sheetName || '접수함').trim() || '접수함';
  const requested = normalizeHeaders(headers);
  if (!id) {
    const error = new Error('Google Sheets 파일이 선택되지 않았습니다.');
    error.status = 400;
    throw error;
  }
  const readRange = encodeURIComponent(`${tab}!1:1`);
  const readResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${readRange}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const readData = await readResponse.json().catch(() => ({}));
  if (!readResponse.ok && readResponse.status !== 404) {
    const error = new Error(`Google Sheets header read failed: ${readResponse.status}`);
    error.status = readResponse.status;
    error.details = readData;
    throw error;
  }
  const current = normalizeHeaders(readData.values?.[0] || []);
  const merged = mergeHeaders(current, requested);
  if (!sameHeaders(current, merged)) {
    const writeRange = encodeURIComponent(`${tab}!A1:${columnName(merged.length)}1`);
    const writeResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${writeRange}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [merged] }),
    });
    const writeData = await writeResponse.json().catch(() => ({}));
    if (!writeResponse.ok) {
      const error = new Error(`Google Sheets header update failed: ${writeResponse.status}`);
      error.status = writeResponse.status;
      error.details = writeData;
      throw error;
    }
  }
  return merged;
}

export function googleSheetsPayloadRow(payload = {}) {
  const table = googleSheetsPayloadTable(payload);
  return table.headers.map((header) => table.valuesByHeader[header] ?? '');
}

export function googleSheetsPayloadTable(payload = {}) {
  const lead = payload.lead || {};
  const page = payload.page || {};
  const source = payload.source || payload.attribution || {};
  const fields = normalizeFieldMap(lead.fields || {});
  const headers = mergeHeaders(GOOGLE_SHEETS_COLUMNS, Object.keys(fields));
  const valuesByHeader = {
    접수일시: lead.createdAt || payload.createdAt || new Date().toISOString(),
    이름: lead.name || '',
    연락처: lead.phone || '',
    이메일: lead.email || '',
    메시지: lead.message || '',
    페이지명: page.title || '',
    '페이지 URL': page.url || '',
    'UTM Source': source.utmSource || '',
    'UTM Medium': source.utmMedium || '',
    'UTM Campaign': source.utmCampaign || '',
    ...fields,
  };
  return { headers, valuesByHeader };
}

export function mergeGoogleTokens(previous = {}, refreshed = {}) {
  return {
    ...previous,
    accessToken: refreshed.access_token || previous.accessToken || '',
    expiresIn: refreshed.expires_in || previous.expiresIn || 0,
    tokenType: refreshed.token_type || previous.tokenType || '',
    scope: refreshed.scope || previous.scope || '',
    refreshedAt: new Date().toISOString(),
  };
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeFieldMap(fields = {}) {
  const normalized = {};
  for (const [rawKey, rawValue] of Object.entries(fields || {})) {
    const key = String(rawKey || '').trim();
    if (!key || GOOGLE_SHEETS_COLUMNS.includes(key)) continue;
    normalized[key] = normalizeSheetCellValue(rawValue);
  }
  return normalized;
}

function normalizeSheetCellValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function normalizeHeaders(headers = []) {
  return headers
    .map((header) => String(header || '').trim())
    .filter((header) => header && header !== '추가 입력값 JSON');
}

function mergeHeaders(base = [], extra = []) {
  const seen = new Set();
  const merged = [];
  for (const header of [...normalizeHeaders(base), ...normalizeHeaders(extra)]) {
    if (seen.has(header)) continue;
    seen.add(header);
    merged.push(header);
  }
  return merged;
}

function sameHeaders(a = [], b = []) {
  const left = normalizeHeaders(a);
  const right = normalizeHeaders(b);
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function columnName(index = 1) {
  let n = Math.max(Number(index) || 1, 1);
  let name = '';
  while (n > 0) {
    n -= 1;
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26);
  }
  return name;
}

function oauthSecret(env = {}) {
  return String(env.GOOGLE_OAUTH_STATE_SECRET || env.INLET_SESSION_SECRET || env.INLET_API_TOKEN || 'pagero-google-oauth-local').trim();
}

async function hmacBase64Url(value = '', secret = '') {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function base64UrlEncode(value = '') {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value = '') {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
