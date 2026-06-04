const GOOGLE_SHEETS_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
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
