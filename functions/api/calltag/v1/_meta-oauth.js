import { decryptProviderCredential, encryptProviderCredential } from './_credentials.js';
import { metaGraphVersion, verifyMetaPageAccess } from './_meta-graph.js';
import { ensureMetaLeadSchema } from './_meta-schema.js';
import { upsertMetaConnection } from './_meta.js';
import { ensureMetaOauthSchema } from './_meta-oauth-schema.js';
import { leadError, limitedJson, randomToken, safeOwner, sha256, text } from './_utils.js';

const OAUTH_TTL_MS = 10 * 60 * 1000;
const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;
const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'leads_retrieval',
];

export async function createMetaOauthSession(db, ownerId = '', env = {}, options = {}) {
  await ensureMetaOauthSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const appId = metaOauthAppId(env);
  const redirectUri = metaOauthRedirectUri(env);
  const returnPath = safeMetaOauthReturnPath(options.returnPath || '/connect');
  const scopes = metaOauthScopes(env);
  const rawState = randomToken(32);
  const stateHash = await sha256(rawState);
  const id = `ctmoauth_${randomToken(14)}`;
  const expiresAt = Date.now() + OAUTH_TTL_MS;

  await expireMetaOauthSessions(db);
  await db.prepare(`
    INSERT INTO calltag_meta_oauth_sessions (
      id, owner_id, state_hash, status, user_token_envelope, pages_json,
      requested_scopes_json, granted_scopes_json, return_path, expires_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, 'pending', '', '[]', ?, '[]', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    id,
    safeOwnerId,
    stateHash,
    limitedJson(scopes, 8192, 'CALLTAG_META_OAUTH_SCOPES_TOO_LARGE'),
    returnPath,
    expiresAt,
  ).run();

  const authorizationUrl = new URL(`https://www.facebook.com/${metaGraphVersion(env)}/dialog/oauth`);
  authorizationUrl.searchParams.set('client_id', appId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('state', rawState);
  authorizationUrl.searchParams.set('scope', scopes.join(','));
  authorizationUrl.searchParams.set('response_type', 'code');

  return {
    authorizationUrl: authorizationUrl.toString(),
    expiresAt,
  };
}

export async function handleMetaOauthCallback(db, request, env = {}) {
  await ensureMetaOauthSchema(db);
  const url = new URL(request.url);
  const rawState = String(url.searchParams.get('state') || '').trim();
  const code = String(url.searchParams.get('code') || '').trim();
  const providerError = text(url.searchParams.get('error') || '', 120);
  const now = Date.now();

  if (!rawState || rawState.length > 512) {
    return metaOauthRedirect(request, '/connect', { meta: 'error', reason: 'state' });
  }

  const stateHash = await sha256(rawState);
  const row = await db.prepare(`
    SELECT * FROM calltag_meta_oauth_sessions WHERE state_hash = ? LIMIT 1
  `).bind(stateHash).first();
  if (!row?.id) return metaOauthRedirect(request, '/connect', { meta: 'error', reason: 'state' });

  const returnPath = safeMetaOauthReturnPath(row.return_path || '/connect');
  if (Number(row.expires_at || 0) <= now) {
    await markMetaOauthTerminal(db, row.id, 'expired', 'CALLTAG_META_OAUTH_EXPIRED');
    return metaOauthRedirect(request, returnPath, { meta: 'error', reason: 'expired' });
  }
  if (providerError || !code) {
    await markMetaOauthTerminal(db, row.id, 'failed', providerError ? 'CALLTAG_META_OAUTH_PROVIDER_DENIED' : 'CALLTAG_META_OAUTH_CODE_REQUIRED');
    return metaOauthRedirect(request, returnPath, { meta: 'error', reason: 'denied' });
  }

  const transition = await db.prepare(`
    UPDATE calltag_meta_oauth_sessions
    SET status = 'exchanging', updated_at = CURRENT_TIMESTAMP, last_error = ''
    WHERE id = ? AND state_hash = ? AND status = 'pending' AND expires_at > ?
  `).bind(row.id, stateHash, now).run();
  if (d1Changes(transition) !== 1) {
    return metaOauthRedirect(request, returnPath, { meta: 'error', reason: 'replay' });
  }

  try {
    const shortToken = await exchangeMetaOauthCode(env, code);
    const longToken = await exchangeMetaLongLivedUserToken(env, shortToken);
    const [pages, grantedScopes] = await Promise.all([
      fetchMetaManagedPages(env, longToken),
      fetchMetaGrantedScopes(env, longToken),
    ]);
    const publicPages = pages.map(({ id, name, tasks }) => ({ id, name, tasks }));
    const envelope = await encryptProviderCredential(
      env,
      longToken,
      metaOauthUserTokenAad(row.owner_id, row.id),
    );

    await db.prepare(`
      UPDATE calltag_meta_oauth_sessions
      SET status = 'authorized', user_token_envelope = ?, pages_json = ?,
          granted_scopes_json = ?, authorized_at = CURRENT_TIMESTAMP,
          last_error = '', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'exchanging'
    `).bind(
      envelope,
      limitedJson(publicPages, 65536, 'CALLTAG_META_OAUTH_PAGES_TOO_LARGE'),
      limitedJson(grantedScopes, 8192, 'CALLTAG_META_OAUTH_SCOPES_TOO_LARGE'),
      row.id,
    ).run();

    return metaOauthRedirect(request, returnPath, { meta: 'ready', metaOAuth: row.id });
  } catch (error) {
    await markMetaOauthTerminal(
      db,
      row.id,
      'failed',
      text(error?.code || error?.details?.code || 'CALLTAG_META_OAUTH_EXCHANGE_FAILED', 120),
    );
    return metaOauthRedirect(request, returnPath, { meta: 'error', reason: 'exchange' });
  }
}

export async function getMetaOauthSession(db, ownerId = '', sessionId = '') {
  await ensureMetaOauthSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const id = text(sessionId, 160);
  const row = await db.prepare(`
    SELECT id, owner_id, status, pages_json, requested_scopes_json, granted_scopes_json,
      return_path, expires_at, authorized_at, completed_at, last_error, created_at, updated_at
    FROM calltag_meta_oauth_sessions
    WHERE id = ? AND owner_id = ? LIMIT 1
  `).bind(id, safeOwnerId).first();
  if (!row?.id) throw leadError('Meta OAuth session was not found.', 404, 'CALLTAG_META_OAUTH_SESSION_NOT_FOUND');

  if (Number(row.expires_at || 0) <= Date.now() && ['pending', 'exchanging', 'authorized'].includes(String(row.status))) {
    await markMetaOauthTerminal(db, row.id, 'expired', 'CALLTAG_META_OAUTH_EXPIRED');
    row.status = 'expired';
    row.last_error = 'CALLTAG_META_OAUTH_EXPIRED';
  }
  return publicMetaOauthSession(row);
}

export async function completeMetaOauthSession(db, ownerId = '', sessionId = '', selectedPageIds = [], env = {}) {
  await ensureMetaOauthSchema(db);
  await ensureMetaLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const id = text(sessionId, 160);
  const row = await db.prepare(`
    SELECT * FROM calltag_meta_oauth_sessions WHERE id = ? AND owner_id = ? LIMIT 1
  `).bind(id, safeOwnerId).first();
  if (!row?.id) throw leadError('Meta OAuth session was not found.', 404, 'CALLTAG_META_OAUTH_SESSION_NOT_FOUND');
  if (Number(row.expires_at || 0) <= Date.now()) {
    await markMetaOauthTerminal(db, row.id, 'expired', 'CALLTAG_META_OAUTH_EXPIRED');
    throw leadError('Meta OAuth session expired.', 410, 'CALLTAG_META_OAUTH_EXPIRED');
  }
  if (String(row.status) === 'completed') {
    return { completed: true, status: 'completed', results: [] };
  }
  if (String(row.status) !== 'authorized' || !row.user_token_envelope) {
    throw leadError('Meta OAuth session is not ready.', 409, 'CALLTAG_META_OAUTH_NOT_AUTHORIZED');
  }

  const pageIds = normalizeSelectedPageIds(selectedPageIds);
  if (!pageIds.length) throw leadError('Select at least one Meta Page.', 400, 'CALLTAG_META_PAGE_SELECTION_REQUIRED');
  const userToken = await decryptProviderCredential(
    env,
    row.user_token_envelope,
    metaOauthUserTokenAad(safeOwnerId, row.id),
  );
  const freshPages = await fetchMetaManagedPages(env, userToken);
  const pagesById = new Map(freshPages.map((page) => [page.id, page]));
  const grantedScopes = parseArrayJson(row.granted_scopes_json).map((scope) => text(scope, 120)).filter(Boolean);
  const results = [];

  for (const pageId of pageIds) {
    const page = pagesById.get(pageId);
    if (!page?.accessToken) {
      results.push({ pageId, ok: false, code: 'CALLTAG_META_PAGE_NOT_AVAILABLE' });
      continue;
    }

    try {
      const existing = await db.prepare(`
        SELECT id, owner_id FROM calltag_meta_connections WHERE page_id = ? LIMIT 1
      `).bind(pageId).first();
      if (existing?.owner_id && String(existing.owner_id) !== safeOwnerId) {
        throw leadError('This Meta Page is already connected to another CallTag account.', 409, 'CALLTAG_META_PAGE_ALREADY_CONNECTED');
      }

      const verified = await verifyMetaPageAccess(env, pageId, page.accessToken);
      await subscribeMetaLeadgen(env, pageId, page.accessToken);
      const connection = await upsertMetaConnection(db, safeOwnerId, {
        pageId,
        pageName: verified.pageName || page.name,
        pageAccessToken: page.accessToken,
        grantedScopes,
      }, env);
      results.push({ pageId, pageName: connection.pageName || page.name, ok: true, connection });
    } catch (error) {
      results.push({
        pageId,
        pageName: text(page?.name, 160),
        ok: false,
        code: text(error?.code || error?.details?.code || 'CALLTAG_META_PAGE_CONNECT_FAILED', 120),
      });
    }
  }

  const completed = results.length === pageIds.length && results.every((item) => item.ok);
  if (completed) {
    await db.prepare(`
      UPDATE calltag_meta_oauth_sessions
      SET status = 'completed', user_token_envelope = '', completed_at = CURRENT_TIMESTAMP,
          last_error = '', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND owner_id = ? AND status = 'authorized'
    `).bind(row.id, safeOwnerId).run();
  } else {
    await db.prepare(`
      UPDATE calltag_meta_oauth_sessions
      SET last_error = 'CALLTAG_META_OAUTH_PARTIAL_CONNECT', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND owner_id = ? AND status = 'authorized'
    `).bind(row.id, safeOwnerId).run();
  }

  return { completed, status: completed ? 'completed' : 'authorized', results };
}

export function safeMetaOauthReturnPath(value = '/connect') {
  const path = String(value || '').trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[\r\n]/.test(path)) return '/connect';
  let parsed = null;
  try { parsed = new URL(path, 'https://calltag.invalid'); }
  catch { return '/connect'; }
  if (parsed.origin !== 'https://calltag.invalid') return '/connect';
  const clean = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return clean.slice(0, 500) || '/connect';
}

export function metaOauthScopes(env = {}) {
  const configured = String(env.CALLTAG_META_OAUTH_SCOPES || '').split(',')
    .map((scope) => String(scope || '').trim())
    .filter((scope) => /^[a-z0-9_]{2,80}$/i.test(scope));
  return Array.from(new Set(configured.length ? configured : DEFAULT_SCOPES)).slice(0, 30);
}

export function buildMetaOauthAuthorizationUrl(env = {}, rawState = 'qa-state', returnRedirectUri = '') {
  const redirectUri = returnRedirectUri || metaOauthRedirectUri(env);
  const url = new URL(`https://www.facebook.com/${metaGraphVersion(env)}/dialog/oauth`);
  url.searchParams.set('client_id', metaOauthAppId(env));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', String(rawState || ''));
  url.searchParams.set('scope', metaOauthScopes(env).join(','));
  url.searchParams.set('response_type', 'code');
  return url.toString();
}

async function exchangeMetaOauthCode(env, code) {
  const body = new URLSearchParams({
    client_id: metaOauthAppId(env),
    client_secret: metaOauthAppSecret(env),
    redirect_uri: metaOauthRedirectUri(env),
    code: String(code || '').trim(),
  });
  const response = await fetch(`https://graph.facebook.com/${metaGraphVersion(env)}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(12000),
  });
  const data = await readProviderJson(response);
  const token = String(data?.access_token || '').trim();
  if (!response.ok || data?.error || token.length < 20) {
    throw leadError('Meta OAuth code exchange failed.', 502, 'CALLTAG_META_OAUTH_CODE_EXCHANGE_FAILED');
  }
  return token;
}

async function exchangeMetaLongLivedUserToken(env, shortToken) {
  const body = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: metaOauthAppId(env),
    client_secret: metaOauthAppSecret(env),
    fb_exchange_token: String(shortToken || ''),
  });
  const response = await fetch(`https://graph.facebook.com/${metaGraphVersion(env)}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(12000),
  });
  const data = await readProviderJson(response);
  const token = String(data?.access_token || '').trim();
  if (!response.ok || data?.error || token.length < 20) {
    throw leadError('Meta long-lived user token exchange failed.', 502, 'CALLTAG_META_LONG_TOKEN_EXCHANGE_FAILED');
  }
  return token;
}

async function fetchMetaManagedPages(env, userToken) {
  const url = new URL(`https://graph.facebook.com/${metaGraphVersion(env)}/me/accounts`);
  url.searchParams.set('fields', 'id,name,access_token,tasks');
  url.searchParams.set('limit', '100');
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${userToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  const data = await readProviderJson(response);
  if (!response.ok || data?.error || !Array.isArray(data?.data)) {
    throw leadError('Meta Pages could not be loaded.', 502, 'CALLTAG_META_PAGES_FETCH_FAILED');
  }
  return data.data.slice(0, 100).map((page) => ({
    id: cleanMetaId(page?.id),
    name: text(page?.name, 160),
    accessToken: String(page?.access_token || '').trim(),
    tasks: Array.isArray(page?.tasks) ? page.tasks.map((task) => text(task, 120)).filter(Boolean).slice(0, 50) : [],
  })).filter((page) => page.id);
}

async function fetchMetaGrantedScopes(env, userToken) {
  const url = new URL(`https://graph.facebook.com/${metaGraphVersion(env)}/me/permissions`);
  url.searchParams.set('limit', '100');
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${userToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  const data = await readProviderJson(response);
  if (!response.ok || data?.error || !Array.isArray(data?.data)) {
    throw leadError('Meta permissions could not be verified.', 502, 'CALLTAG_META_PERMISSIONS_FETCH_FAILED');
  }
  return Array.from(new Set(data.data
    .filter((item) => String(item?.status || '').toLowerCase() === 'granted')
    .map((item) => text(item?.permission, 120))
    .filter(Boolean))).slice(0, 100);
}

async function subscribeMetaLeadgen(env, pageId, pageAccessToken) {
  const url = new URL(`https://graph.facebook.com/${metaGraphVersion(env)}/${encodeURIComponent(pageId)}/subscribed_apps`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pageAccessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ subscribed_fields: 'leadgen' }),
    signal: AbortSignal.timeout(12000),
  });
  const data = await readProviderJson(response);
  if (!response.ok || data?.error || data?.success !== true) {
    throw leadError('Meta Lead Ads webhook subscription failed.', 502, 'CALLTAG_META_SUBSCRIBE_FAILED');
  }
}

async function readProviderJson(response, maxBytes = MAX_PROVIDER_RESPONSE_BYTES) {
  const declared = Number(response.headers.get('Content-Length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw leadError('Meta provider response was too large.', 502, 'CALLTAG_META_PROVIDER_RESPONSE_TOO_LARGE');
  }
  const reader = response.body?.getReader?.();
  if (!reader) {
    const textBody = await response.text();
    if (new TextEncoder().encode(textBody).length > maxBytes) {
      throw leadError('Meta provider response was too large.', 502, 'CALLTAG_META_PROVIDER_RESPONSE_TOO_LARGE');
    }
    try { return JSON.parse(textBody || '{}'); } catch { return {}; }
  }
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      throw leadError('Meta provider response was too large.', 502, 'CALLTAG_META_PROVIDER_RESPONSE_TOO_LARGE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try { return JSON.parse(new TextDecoder().decode(bytes) || '{}'); } catch { return {}; }
}

async function expireMetaOauthSessions(db) {
  const now = Date.now();
  await db.prepare(`
    UPDATE calltag_meta_oauth_sessions
    SET status = 'expired', user_token_envelope = '', last_error = 'CALLTAG_META_OAUTH_EXPIRED', updated_at = CURRENT_TIMESTAMP
    WHERE expires_at <= ? AND status IN ('pending', 'exchanging', 'authorized')
  `).bind(now).run();
}

async function markMetaOauthTerminal(db, id, status, code) {
  const safeStatus = ['failed', 'expired'].includes(status) ? status : 'failed';
  await db.prepare(`
    UPDATE calltag_meta_oauth_sessions
    SET status = ?, user_token_envelope = '', last_error = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status <> 'completed'
  `).bind(safeStatus, text(code, 120), id).run();
}

function publicMetaOauthSession(row = {}) {
  return {
    id: String(row?.id || ''),
    status: String(row?.status || ''),
    pages: parseArrayJson(row?.pages_json).map((page) => ({
      id: cleanMetaId(page?.id),
      name: text(page?.name, 160),
      tasks: Array.isArray(page?.tasks) ? page.tasks.map((task) => text(task, 120)).filter(Boolean).slice(0, 50) : [],
    })).filter((page) => page.id),
    requestedScopes: parseArrayJson(row?.requested_scopes_json).map((scope) => text(scope, 120)).filter(Boolean),
    grantedScopes: parseArrayJson(row?.granted_scopes_json).map((scope) => text(scope, 120)).filter(Boolean),
    expiresAt: Number(row?.expires_at || 0),
    authorizedAt: String(row?.authorized_at || ''),
    completedAt: String(row?.completed_at || ''),
    lastError: String(row?.last_error || ''),
  };
}

function metaOauthRedirect(request, returnPath, params = {}) {
  const target = new URL(safeMetaOauthReturnPath(returnPath), new URL(request.url).origin);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') target.searchParams.set(key, String(value).slice(0, 200));
  }
  return Response.redirect(target.toString(), 302);
}

function metaOauthAppId(env = {}) {
  const value = String(env.CALLTAG_META_APP_ID || '').trim();
  if (!/^[0-9]{3,40}$/.test(value)) throw leadError('Meta App ID is not configured.', 503, 'CALLTAG_META_APP_ID_REQUIRED');
  return value;
}

function metaOauthAppSecret(env = {}) {
  const value = String(env.CALLTAG_META_APP_SECRET || '').trim();
  if (value.length < 16) throw leadError('Meta App Secret is not configured.', 503, 'CALLTAG_META_APP_SECRET_REQUIRED');
  return value;
}

function metaOauthRedirectUri(env = {}) {
  const value = String(env.CALLTAG_META_OAUTH_REDIRECT_URI || '').trim();
  let url = null;
  try { url = new URL(value); } catch {}
  if (!url || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw leadError('Meta OAuth redirect URI is not configured.', 503, 'CALLTAG_META_OAUTH_REDIRECT_URI_REQUIRED');
  }
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw leadError('Meta OAuth redirect URI must use HTTPS.', 503, 'CALLTAG_META_OAUTH_REDIRECT_URI_INVALID');
  }
  return url.toString();
}

function metaOauthUserTokenAad(ownerId, sessionId) {
  return `calltag:meta-oauth-user-token:v1:${text(ownerId, 160)}:${text(sessionId, 160)}`;
}

function normalizeSelectedPageIds(value) {
  const list = Array.isArray(value) ? value : [value];
  return Array.from(new Set(list.map(cleanMetaId).filter(Boolean))).slice(0, 50);
}

function cleanMetaId(value = '') {
  const id = String(value || '').trim();
  return /^[0-9]{3,40}$/.test(id) ? id : '';
}

function parseArrayJson(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function d1Changes(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}
