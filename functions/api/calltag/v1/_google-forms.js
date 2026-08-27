import { googleAuthRedirectUri } from '../../auth/_auth.js';
import { decryptProviderCredential, encryptProviderCredential } from './_credentials.js';
import { ensureGoogleFormsSchema } from './_google-forms-schema.js';
import { intakeCanonicalLead } from './_store.js';
import { leadError, parseStoredJson, randomToken, safeOwner, sha256, text } from './_utils.js';

const OAUTH_TTL_MS = 10 * 60 * 1000;
const GOOGLE_FORMS_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
];
const DEFAULT_ANDROID_RETURN = '/api/calltag/v1/google-forms/oauth/android-return';

export async function createGoogleFormsOauthSession(db, ownerId = '', request, env = {}, options = {}) {
  await ensureGoogleFormsSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const clientId = googleClientId(env);
  if (!clientId) throw leadError('Google Forms OAuth is not configured.', 503, 'CALLTAG_GOOGLE_FORMS_OAUTH_NOT_CONFIGURED');
  const rawState = randomToken(32);
  const stateHash = await sha256(rawState);
  const id = `ctgfoauth_${randomToken(14)}`;
  const expiresAt = Date.now() + OAUTH_TTL_MS;
  const returnPath = safeReturnPath(options.returnPath || DEFAULT_ANDROID_RETURN);

  await expireGoogleFormsOauthSessions(db);
  await db.prepare(`
    INSERT INTO calltag_google_forms_oauth_sessions (
      id, owner_id, state_hash, status, refresh_token_envelope, google_email,
      scopes_json, return_path, expires_at, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, 'pending', '', '', ?, ?, ?, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(id, safeOwnerId, JSON.stringify(GOOGLE_FORMS_SCOPES), returnPath, expiresAt).run();

  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('redirect_uri', googleAuthRedirectUri(request, env));
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', GOOGLE_FORMS_SCOPES.join(' '));
  authorizationUrl.searchParams.set('state', rawState);
  authorizationUrl.searchParams.set('access_type', 'offline');
  authorizationUrl.searchParams.set('prompt', 'consent');
  authorizationUrl.searchParams.set('include_granted_scopes', 'true');

  return { id, authorizationUrl: authorizationUrl.toString(), expiresAt };
}

/**
 * Handles Google Forms OAuth states on the already-registered Google callback URL.
 * Returns null when the state belongs to the normal sign-in flow.
 */
export async function maybeHandleGoogleFormsOauthCallback(db, request, env = {}) {
  await ensureGoogleFormsSchema(db);
  const url = new URL(request.url);
  const rawState = text(url.searchParams.get('state'), 512);
  if (!rawState) return null;
  const stateHash = await sha256(rawState);
  const row = await db.prepare(`
    SELECT * FROM calltag_google_forms_oauth_sessions WHERE state_hash = ? LIMIT 1
  `).bind(stateHash).first();
  if (!row?.id) return null;

  const returnPath = safeReturnPath(row.return_path || DEFAULT_ANDROID_RETURN);
  if (Number(row.expires_at || 0) <= Date.now()) {
    await markOauthTerminal(db, row.id, 'expired', 'CALLTAG_GOOGLE_FORMS_OAUTH_EXPIRED');
    return oauthRedirect(request, returnPath, { googleForms: 'error', reason: 'expired' });
  }
  const providerError = text(url.searchParams.get('error'), 120);
  const code = text(url.searchParams.get('code'), 4096);
  if (providerError || !code) {
    await markOauthTerminal(db, row.id, 'failed', providerError || 'CALLTAG_GOOGLE_FORMS_CODE_REQUIRED');
    return oauthRedirect(request, returnPath, { googleForms: 'error', reason: providerError ? 'denied' : 'code' });
  }

  try {
    const tokens = await exchangeAuthorizationCode(request, env, code);
    const refreshToken = String(tokens.refresh_token || '').trim();
    if (!refreshToken) {
      throw leadError('Google did not return an offline refresh token.', 502, 'CALLTAG_GOOGLE_FORMS_REFRESH_TOKEN_REQUIRED');
    }
    const email = await fetchGoogleEmail(tokens.access_token);
    const envelope = await encryptProviderCredential(
      env,
      refreshToken,
      oauthCredentialAad(row.owner_id, row.id),
    );
    await db.prepare(`
      UPDATE calltag_google_forms_oauth_sessions
      SET status = 'authorized', refresh_token_envelope = ?, google_email = ?,
          last_error = '', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `).bind(envelope, email, row.id).run();
    return oauthRedirect(request, returnPath, { googleForms: 'ready', googleFormsOAuth: row.id });
  } catch (error) {
    await markOauthTerminal(db, row.id, 'failed', text(error?.code || error?.message || 'CALLTAG_GOOGLE_FORMS_OAUTH_FAILED', 160));
    return oauthRedirect(request, returnPath, { googleForms: 'error', reason: 'exchange' });
  }
}

export async function getGoogleFormsOauthSession(db, ownerId = '', sessionId = '') {
  await ensureGoogleFormsSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const id = text(sessionId, 180);
  const row = await db.prepare(`
    SELECT id, owner_id, status, google_email, scopes_json, return_path, expires_at,
      last_error, created_at, updated_at
    FROM calltag_google_forms_oauth_sessions
    WHERE id = ? AND owner_id = ? LIMIT 1
  `).bind(id, safeOwnerId).first();
  if (!row?.id) throw leadError('Google Forms OAuth session was not found.', 404, 'CALLTAG_GOOGLE_FORMS_OAUTH_SESSION_NOT_FOUND');
  if (Number(row.expires_at || 0) <= Date.now() && ['pending', 'authorized'].includes(String(row.status))) {
    await markOauthTerminal(db, row.id, 'expired', 'CALLTAG_GOOGLE_FORMS_OAUTH_EXPIRED');
    row.status = 'expired';
    row.last_error = 'CALLTAG_GOOGLE_FORMS_OAUTH_EXPIRED';
  }
  return publicOauth(row);
}

export async function listGoogleFormsForOauth(db, ownerId = '', sessionId = '', env = {}) {
  await ensureGoogleFormsSchema(db);
  const row = await authorizedOauthRow(db, ownerId, sessionId);
  const refreshToken = await decryptProviderCredential(env, row.refresh_token_envelope, oauthCredentialAad(row.owner_id, row.id));
  const accessToken = await refreshGoogleAccessToken(env, refreshToken);
  return fetchGoogleFormsFiles(accessToken);
}

export async function completeGoogleFormsConnection(db, ownerId = '', sessionId = '', formId = '', env = {}) {
  await ensureGoogleFormsSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const row = await authorizedOauthRow(db, safeOwnerId, sessionId);
  const refreshToken = await decryptProviderCredential(env, row.refresh_token_envelope, oauthCredentialAad(row.owner_id, row.id));
  const accessToken = await refreshGoogleAccessToken(env, refreshToken);
  const safeFormId = normalizeGoogleId(formId);
  if (!safeFormId) throw leadError('Select a Google Form.', 400, 'CALLTAG_GOOGLE_FORMS_FORM_REQUIRED');
  const form = await fetchForm(accessToken, safeFormId);
  const mapping = detectFormMapping(form);
  if (!mapping.phoneQuestionId) {
    throw leadError('전화번호 질문을 자동으로 찾지 못했습니다. 질문 제목에 전화번호 또는 연락처를 포함해주세요.', 422, 'CALLTAG_GOOGLE_FORMS_PHONE_FIELD_NOT_FOUND');
  }

  const existing = await db.prepare(`
    SELECT id FROM calltag_google_forms_connections
    WHERE owner_id = ? AND form_id = ? LIMIT 1
  `).bind(safeOwnerId, safeFormId).first();
  const connectionId = String(existing?.id || `ctgf_${randomToken(14)}`);
  const connectionEnvelope = await encryptProviderCredential(
    env,
    refreshToken,
    connectionCredentialAad(safeOwnerId, connectionId),
  );
  const now = Date.now();
  await db.prepare(`
    INSERT INTO calltag_google_forms_connections (
      id, owner_id, form_id, form_title, google_email, refresh_token_envelope,
      mapping_json, status, last_synced_at_ms, last_response_id, last_error,
      created_at, updated_at, revoked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, '', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '')
    ON CONFLICT(owner_id, form_id) DO UPDATE SET
      form_title = excluded.form_title,
      google_email = excluded.google_email,
      refresh_token_envelope = excluded.refresh_token_envelope,
      mapping_json = excluded.mapping_json,
      status = 'active',
      last_synced_at_ms = excluded.last_synced_at_ms,
      last_error = '',
      revoked_at = '',
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    connectionId,
    safeOwnerId,
    safeFormId,
    text(form?.info?.title || 'Google Form', 240),
    text(row.google_email, 240),
    connectionEnvelope,
    JSON.stringify(mapping),
    now,
  ).run();

  await db.prepare(`
    UPDATE calltag_google_forms_oauth_sessions
    SET status = 'completed', refresh_token_envelope = '', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_id = ?
  `).bind(row.id, safeOwnerId).run();

  return getGoogleFormsConnection(db, safeOwnerId, connectionId);
}

export async function listGoogleFormsConnections(db, ownerId = '') {
  await ensureGoogleFormsSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const rows = await db.prepare(`
    SELECT id, owner_id, form_id, form_title, google_email, mapping_json, status,
      last_synced_at_ms, last_response_id, last_error, created_at, updated_at, revoked_at
    FROM calltag_google_forms_connections
    WHERE owner_id = ?
    ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 100
  `).bind(safeOwnerId).all();
  return (rows?.results || []).map(publicConnection);
}

export async function revokeGoogleFormsConnection(db, ownerId = '', connectionId = '') {
  await ensureGoogleFormsSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const id = text(connectionId, 160);
  await db.prepare(`
    UPDATE calltag_google_forms_connections
    SET status = 'revoked', refresh_token_envelope = '', revoked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_id = ?
  `).bind(id, safeOwnerId).run();
  return { revoked: true, id };
}

export async function syncGoogleFormsConnections(db, ownerId = '', env = {}) {
  await ensureGoogleFormsSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const rows = await db.prepare(`
    SELECT * FROM calltag_google_forms_connections
    WHERE owner_id = ? AND status = 'active'
    ORDER BY updated_at ASC
    LIMIT 20
  `).bind(safeOwnerId).all();
  const results = [];
  let created = 0;
  let duplicates = 0;
  let failed = 0;
  for (const row of rows?.results || []) {
    try {
      const result = await syncOneConnection(db, row, env);
      created += result.created;
      duplicates += result.duplicates;
      results.push({ id: row.id, ok: true, ...result });
    } catch (error) {
      failed++;
      const code = text(error?.code || error?.details?.code || error?.message || 'CALLTAG_GOOGLE_FORMS_SYNC_FAILED', 180);
      await db.prepare(`
        UPDATE calltag_google_forms_connections SET last_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND owner_id = ?
      `).bind(code, row.id, safeOwnerId).run();
      results.push({ id: row.id, ok: false, code });
    }
  }
  return { connections: results.length, created, duplicates, failed, results };
}

async function syncOneConnection(db, row, env) {
  const refreshToken = await decryptProviderCredential(
    env,
    row.refresh_token_envelope,
    connectionCredentialAad(row.owner_id, row.id),
  );
  const accessToken = await refreshGoogleAccessToken(env, refreshToken);
  const mapping = parseStoredJson(row.mapping_json, {});
  const sinceMs = Math.max(0, Number(row.last_synced_at_ms || 0));
  const responses = await fetchFormResponses(accessToken, row.form_id, sinceMs);
  let newestMs = sinceMs;
  let lastResponseId = String(row.last_response_id || '');
  let created = 0;
  let duplicates = 0;

  for (const response of responses) {
    const submittedMs = Date.parse(response?.lastSubmittedTime || response?.createTime || '') || Date.now();
    newestMs = Math.max(newestMs, submittedMs);
    lastResponseId = text(response?.responseId || lastResponseId, 240);
    const lead = canonicalLeadFromGoogleForm(row, mapping, response, submittedMs);
    const intake = await intakeCanonicalLead(db, row.owner_id, lead, {
      connectionId: row.id,
      idempotencyKey: `google_forms:${row.form_id}:${response?.responseId || submittedMs}`,
    });
    if (intake.created) created++;
    else duplicates++;
  }

  const checkpoint = Math.max(newestMs, Date.now() - 1000);
  await db.prepare(`
    UPDATE calltag_google_forms_connections
    SET last_synced_at_ms = ?, last_response_id = ?, last_error = '', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_id = ?
  `).bind(checkpoint, lastResponseId, row.id, row.owner_id).run();
  return { created, duplicates, checked: responses.length, lastSyncedAtMs: checkpoint };
}

function canonicalLeadFromGoogleForm(row, mapping, response, submittedMs) {
  const values = answerValues(response?.answers || {});
  const phone = values[mapping.phoneQuestionId] || '';
  const name = mapping.nameQuestionId ? values[mapping.nameQuestionId] || '' : '';
  const email = mapping.emailQuestionId ? values[mapping.emailQuestionId] || '' : '';
  const content = mapping.contentQuestionId ? values[mapping.contentQuestionId] || '' : '';
  const fields = (mapping.questions || []).slice(0, 100).map((question, index) => ({
    key: question.id,
    label: question.title,
    value: values[question.id] || '',
    order: index + 1,
  }));
  return {
    external_id: text(response?.responseId, 240),
    source: {
      type: 'google_forms',
      name: text(row.form_title || 'Google Forms', 160),
      provider: 'google_forms',
      form_id: text(row.form_id, 240),
    },
    customer: { name, phone, email },
    inquiry: { content, fields },
    submitted_at: submittedMs,
    metadata: {
      googleFormId: text(row.form_id, 240),
      googleResponseId: text(response?.responseId, 240),
    },
  };
}

function answerValues(answers = {}) {
  const out = {};
  for (const [questionId, answer] of Object.entries(answers || {})) {
    const textAnswers = answer?.textAnswers?.answers;
    if (Array.isArray(textAnswers)) {
      out[questionId] = textAnswers.map((item) => String(item?.value || '')).filter(Boolean).join(', ');
      continue;
    }
    const fileAnswers = answer?.fileUploadAnswers?.answers;
    if (Array.isArray(fileAnswers)) {
      out[questionId] = fileAnswers.map((item) => String(item?.fileName || item?.fileId || '')).filter(Boolean).join(', ');
    }
  }
  return out;
}

function detectFormMapping(form = {}) {
  const questions = extractQuestions(form);
  const pick = (regex) => questions.find((q) => regex.test(q.title))?.id || '';
  return {
    phoneQuestionId: pick(/전화|연락처|휴대폰|핸드폰|phone|mobile|tel/i),
    nameQuestionId: pick(/이름|성명|성함|name/i),
    emailQuestionId: pick(/이메일|메일|e-?mail/i),
    contentQuestionId: pick(/문의|내용|상담|요청|메시지|message|content/i),
    questions,
  };
}

function extractQuestions(form = {}) {
  const out = [];
  for (const item of Array.isArray(form.items) ? form.items : []) {
    const title = text(item?.title || '', 200);
    const direct = item?.questionItem?.question;
    if (direct?.questionId) out.push({ id: text(direct.questionId, 160), title: title || '질문' });
    const group = item?.questionGroupItem?.questions;
    if (Array.isArray(group)) {
      group.forEach((question, index) => {
        if (question?.questionId) out.push({
          id: text(question.questionId, 160),
          title: title ? `${title} ${index + 1}` : `질문 ${index + 1}`,
        });
      });
    }
  }
  return out;
}

async function authorizedOauthRow(db, ownerId, sessionId) {
  const safeOwnerId = safeOwner(ownerId);
  const id = text(sessionId, 180);
  const row = await db.prepare(`
    SELECT * FROM calltag_google_forms_oauth_sessions
    WHERE id = ? AND owner_id = ? LIMIT 1
  `).bind(id, safeOwnerId).first();
  if (!row?.id) throw leadError('Google Forms OAuth session was not found.', 404, 'CALLTAG_GOOGLE_FORMS_OAUTH_SESSION_NOT_FOUND');
  if (Number(row.expires_at || 0) <= Date.now()) throw leadError('Google Forms OAuth session expired.', 410, 'CALLTAG_GOOGLE_FORMS_OAUTH_EXPIRED');
  if (String(row.status) !== 'authorized' || !row.refresh_token_envelope) {
    throw leadError('Google Forms authorization is not ready.', 409, 'CALLTAG_GOOGLE_FORMS_OAUTH_NOT_AUTHORIZED');
  }
  return row;
}

async function getGoogleFormsConnection(db, ownerId, connectionId) {
  const row = await db.prepare(`
    SELECT id, owner_id, form_id, form_title, google_email, mapping_json, status,
      last_synced_at_ms, last_response_id, last_error, created_at, updated_at, revoked_at
    FROM calltag_google_forms_connections
    WHERE id = ? AND owner_id = ? LIMIT 1
  `).bind(connectionId, ownerId).first();
  if (!row?.id) throw leadError('Google Forms connection was not found.', 404, 'CALLTAG_GOOGLE_FORMS_CONNECTION_NOT_FOUND');
  return publicConnection(row);
}

function publicConnection(row = {}) {
  const mapping = parseStoredJson(row.mapping_json, {});
  return {
    id: String(row.id || ''),
    formId: String(row.form_id || ''),
    formTitle: String(row.form_title || ''),
    googleEmail: String(row.google_email || ''),
    status: String(row.status || 'active'),
    mappingReady: !!mapping.phoneQuestionId,
    lastSyncedAtMs: Number(row.last_synced_at_ms || 0),
    lastResponseId: String(row.last_response_id || ''),
    lastError: String(row.last_error || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function publicOauth(row = {}) {
  return {
    id: String(row.id || ''),
    status: String(row.status || ''),
    googleEmail: String(row.google_email || ''),
    expiresAt: Number(row.expires_at || 0),
    lastError: String(row.last_error || ''),
  };
}

async function exchangeAuthorizationCode(request, env, code) {
  const body = new URLSearchParams({
    client_id: googleClientId(env),
    client_secret: googleClientSecret(env),
    code: String(code || ''),
    grant_type: 'authorization_code',
    redirect_uri: googleAuthRedirectUri(request, env),
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(12000),
  });
  const data = await readGoogleJson(response);
  if (!response.ok || data?.error || !data?.access_token) {
    throw leadError('Google OAuth token exchange failed.', 502, 'CALLTAG_GOOGLE_FORMS_TOKEN_EXCHANGE_FAILED');
  }
  return data;
}

async function refreshGoogleAccessToken(env, refreshToken) {
  const body = new URLSearchParams({
    client_id: googleClientId(env),
    client_secret: googleClientSecret(env),
    refresh_token: String(refreshToken || ''),
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(12000),
  });
  const data = await readGoogleJson(response);
  if (!response.ok || data?.error || !data?.access_token) {
    throw leadError('Google authorization expired. Reconnect Google Forms.', 401, 'CALLTAG_GOOGLE_FORMS_TOKEN_REFRESH_FAILED');
  }
  return String(data.access_token);
}

async function fetchGoogleEmail(accessToken) {
  const response = await googleFetch('https://www.googleapis.com/oauth2/v2/userinfo', accessToken);
  return text(response?.email, 240).toLowerCase();
}

async function fetchGoogleFormsFiles(accessToken) {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', "mimeType='application/vnd.google-apps.form' and trashed=false");
  url.searchParams.set('fields', 'files(id,name,modifiedTime,webViewLink)');
  url.searchParams.set('orderBy', 'modifiedTime desc');
  url.searchParams.set('pageSize', '100');
  const data = await googleFetch(url.toString(), accessToken);
  return (Array.isArray(data?.files) ? data.files : []).map((file) => ({
    id: text(file?.id, 240),
    name: text(file?.name || 'Google Form', 240),
    modifiedTime: text(file?.modifiedTime, 80),
  })).filter((file) => file.id);
}

async function fetchForm(accessToken, formId) {
  return googleFetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`, accessToken);
}

async function fetchFormResponses(accessToken, formId, sinceMs) {
  const responses = [];
  let pageToken = '';
  const filter = sinceMs > 0 ? `timestamp > ${new Date(sinceMs).toISOString()}` : '';
  for (let page = 0; page < 10; page++) {
    const url = new URL(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}/responses`);
    if (filter) url.searchParams.set('filter', filter);
    url.searchParams.set('pageSize', '500');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await googleFetch(url.toString(), accessToken);
    responses.push(...(Array.isArray(data?.responses) ? data.responses : []));
    pageToken = text(data?.nextPageToken, 1000);
    if (!pageToken) break;
  }
  responses.sort((a, b) => Date.parse(a?.lastSubmittedTime || a?.createTime || '') - Date.parse(b?.lastSubmittedTime || b?.createTime || ''));
  return responses.slice(0, 5000);
}

async function googleFetch(url, accessToken) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  const data = await readGoogleJson(response);
  if (!response.ok || data?.error) {
    throw leadError('Google Forms data could not be loaded.', response.status === 401 ? 401 : 502, 'CALLTAG_GOOGLE_FORMS_PROVIDER_FAILED');
  }
  return data;
}

async function readGoogleJson(response) {
  const textBody = await response.text();
  try { return textBody ? JSON.parse(textBody) : {}; }
  catch { return {}; }
}

async function expireGoogleFormsOauthSessions(db) {
  try {
    await db.prepare(`
      UPDATE calltag_google_forms_oauth_sessions
      SET status = 'expired', refresh_token_envelope = '', last_error = 'CALLTAG_GOOGLE_FORMS_OAUTH_EXPIRED',
          updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('pending','authorized') AND expires_at <= ?
    `).bind(Date.now()).run();
  } catch {}
}

async function markOauthTerminal(db, id, status, errorCode) {
  await db.prepare(`
    UPDATE calltag_google_forms_oauth_sessions
    SET status = ?, refresh_token_envelope = '', last_error = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, text(errorCode, 160), id).run();
}

function oauthRedirect(request, path, params = {}) {
  const target = new URL(path, request.url);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && String(value) !== '') target.searchParams.set(key, String(value));
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function safeReturnPath(value = DEFAULT_ANDROID_RETURN) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\r\n]/.test(raw)) return DEFAULT_ANDROID_RETURN;
  try {
    const url = new URL(raw, 'https://calltag.invalid');
    if (url.origin !== 'https://calltag.invalid') return DEFAULT_ANDROID_RETURN;
    return `${url.pathname}${url.search}${url.hash}`.slice(0, 500) || DEFAULT_ANDROID_RETURN;
  } catch {
    return DEFAULT_ANDROID_RETURN;
  }
}

function googleClientId(env = {}) {
  return String(env.GOOGLE_AUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_CLIENT_ID || '').trim();
}

function googleClientSecret(env = {}) {
  const value = String(env.GOOGLE_AUTH_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || '').trim();
  if (!value) throw leadError('Google OAuth client secret is not configured.', 503, 'CALLTAG_GOOGLE_FORMS_CLIENT_SECRET_REQUIRED');
  return value;
}

function normalizeGoogleId(value = '') {
  const id = text(value, 240);
  return /^[A-Za-z0-9_-]{10,240}$/.test(id) ? id : '';
}

function oauthCredentialAad(ownerId, sessionId) {
  return `calltag:google-forms:oauth:${ownerId}:${sessionId}`;
}

function connectionCredentialAad(ownerId, connectionId) {
  return `calltag:google-forms:connection:${ownerId}:${connectionId}`;
}
