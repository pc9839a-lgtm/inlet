import { notifyUniversalLeadAvailable } from '../../call/push/_shared.js';
import { decryptProviderCredential, encryptProviderCredential, hmacSha256Hex, timingSafeEqualText } from './_credentials.js';
import { ensureMetaLeadSchema } from './_meta-schema.js';
import { intakeCanonicalLead, recordLeadAudit } from './_store.js';
import { MAX_BODY_BYTES, leadError, limitedJson, randomToken, safeFieldValue, safeOwner, text } from './_utils.js';

const MAX_META_EVENTS = 100;
const DEFAULT_GRAPH_VERSION = 'v24.0';
const CONTACT_FIELDS = new Set([
  'phone_number', 'phone', 'mobile_number', 'mobile',
  'full_name', 'name', 'first_name', 'last_name', 'email', 'email_address',
]);

export async function upsertMetaConnection(db, ownerId = '', input = {}, env = {}) {
  await ensureMetaLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const pageId = metaId(input.pageId || input.page_id, 'CALLTAG_META_PAGE_ID_REQUIRED');
  const pageName = text(input.pageName || input.page_name || 'Meta Lead Ads', 160) || 'Meta Lead Ads';
  const pageAccessToken = String(input.pageAccessToken || input.page_access_token || '').trim();
  if (pageAccessToken.length < 20 || pageAccessToken.length > 8192) {
    throw leadError('A valid Meta Page access token is required.', 400, 'CALLTAG_META_PAGE_TOKEN_REQUIRED');
  }

  const existing = await db.prepare(`
    SELECT id, owner_id FROM calltag_meta_connections WHERE page_id = ? LIMIT 1
  `).bind(pageId).first();
  if (existing?.owner_id && String(existing.owner_id) !== safeOwnerId) {
    throw leadError('This Meta Page is already connected to another CallTag account.', 409, 'CALLTAG_META_PAGE_ALREADY_CONNECTED');
  }

  const connectionId = String(existing?.id || `ctmeta_${randomToken(14)}`);
  const envelope = await encryptProviderCredential(env, pageAccessToken, metaCredentialAad(safeOwnerId, pageId));
  const scopes = Array.isArray(input.grantedScopes || input.granted_scopes)
    ? Array.from(new Set((input.grantedScopes || input.granted_scopes)
        .map((scope) => text(scope, 120))
        .filter(Boolean))).slice(0, 50)
    : [];
  const scopesJson = limitedJson(scopes, 8192, 'CALLTAG_META_SCOPES_TOO_LARGE');
  const tokenExpiresAt = normalizeOptionalDate(input.tokenExpiresAt || input.token_expires_at);

  await db.prepare(`
    INSERT INTO calltag_meta_connections (
      id, owner_id, page_id, page_name, status, credential_envelope,
      token_expires_at, granted_scopes_json, last_error,
      created_at, updated_at, revoked_at
    ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '')
    ON CONFLICT(page_id) DO UPDATE SET
      page_name = excluded.page_name,
      status = 'active',
      credential_envelope = excluded.credential_envelope,
      token_expires_at = excluded.token_expires_at,
      granted_scopes_json = excluded.granted_scopes_json,
      last_error = '',
      updated_at = CURRENT_TIMESTAMP,
      revoked_at = ''
  `).bind(connectionId, safeOwnerId, pageId, pageName, envelope, tokenExpiresAt, scopesJson).run();

  return publicMetaConnection(await getOwnedMetaConnection(db, safeOwnerId, connectionId));
}

export async function listMetaConnections(db, ownerId = '') {
  await ensureMetaLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const result = await db.prepare(`
    SELECT id, owner_id, page_id, page_name, status, token_expires_at,
      granted_scopes_json, last_webhook_at, last_lead_at, last_error,
      created_at, updated_at, revoked_at
    FROM calltag_meta_connections
    WHERE owner_id = ?
    ORDER BY created_at DESC, id DESC
  `).bind(safeOwnerId).all();
  return (result?.results || []).map(publicMetaConnection);
}

export async function revokeMetaConnection(db, ownerId = '', connectionId = '') {
  await ensureMetaLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const current = await getOwnedMetaConnection(db, safeOwnerId, connectionId);
  if (!current?.id) throw leadError('Meta connection was not found.', 404, 'CALLTAG_META_CONNECTION_NOT_FOUND');
  await db.prepare(`
    UPDATE calltag_meta_connections
    SET status = 'revoked', credential_envelope = '', revoked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_id = ?
  `).bind(current.id, safeOwnerId).run();
  return publicMetaConnection(await getOwnedMetaConnection(db, safeOwnerId, current.id));
}

export function verifyMetaWebhookChallenge(request, env = {}) {
  const url = new URL(request.url);
  const mode = String(url.searchParams.get('hub.mode') || '');
  const supplied = String(url.searchParams.get('hub.verify_token') || '');
  const challenge = String(url.searchParams.get('hub.challenge') || '');
  const expected = metaVerifyToken(env);
  if (mode !== 'subscribe' || !challenge || !expected || !timingSafeEqualText(supplied, expected)) {
    throw leadError('Meta webhook verification failed.', 403, 'CALLTAG_META_WEBHOOK_VERIFY_FAILED');
  }
  return challenge.slice(0, 4096);
}

export async function acceptMetaWebhookRequest(request, env = {}) {
  const raw = await readRawBodyLimited(request, MAX_BODY_BYTES);
  const supplied = String(request.headers.get('X-Hub-Signature-256') || request.headers.get('x-hub-signature-256') || '');
  const match = /^sha256=([a-f0-9]{64})$/i.exec(supplied);
  if (!match) throw leadError('Meta webhook signature is required.', 401, 'CALLTAG_META_SIGNATURE_REQUIRED');
  const expectedHex = await hmacSha256Hex(metaAppSecret(env), raw);
  if (!timingSafeEqualText(match[1].toLowerCase(), expectedHex)) {
    throw leadError('Meta webhook signature is invalid.', 401, 'CALLTAG_META_SIGNATURE_INVALID');
  }

  let payload = null;
  try { payload = JSON.parse(new TextDecoder().decode(raw)); }
  catch { throw leadError('Meta webhook JSON is invalid.', 400, 'CALLTAG_META_JSON_INVALID'); }
  if (!payload || payload.object !== 'page' || !Array.isArray(payload.entry)) {
    return { events: [] };
  }

  const events = [];
  for (const entry of payload.entry.slice(0, MAX_META_EVENTS)) {
    const pageId = cleanMetaId(entry?.id);
    if (!pageId || !Array.isArray(entry?.changes)) continue;
    for (const change of entry.changes) {
      if (events.length >= MAX_META_EVENTS) break;
      if (String(change?.field || '') !== 'leadgen') continue;
      const value = change?.value && typeof change.value === 'object' ? change.value : {};
      const leadgenId = cleanMetaId(value.leadgen_id || value.lead_id);
      if (!leadgenId) continue;
      events.push({
        pageId,
        leadgenId,
        formId: cleanMetaId(value.form_id),
        adId: cleanMetaId(value.ad_id),
        createdTime: value.created_time || '',
      });
    }
  }
  return { events };
}

export async function processMetaLeadEvents(env = {}, db, events = [], options = {}) {
  await ensureMetaLeadSchema(db);
  const requestId = text(options.requestId || `meta_${randomToken(8)}`, 120);
  const unique = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    if (!event?.pageId || !event?.leadgenId) continue;
    unique.set(`${event.pageId}:${event.leadgenId}`, event);
  }

  const summary = { attempted: 0, imported: 0, duplicates: 0, ignored: 0, failed: 0 };
  for (const event of Array.from(unique.values()).slice(0, MAX_META_EVENTS)) {
    summary.attempted++;
    const connection = await db.prepare(`
      SELECT * FROM calltag_meta_connections
      WHERE page_id = ? AND status IN ('active', 'error')
      LIMIT 1
    `).bind(event.pageId).first();
    if (!connection?.id || !connection?.owner_id || !connection?.credential_envelope) {
      summary.ignored++;
      continue;
    }

    await db.prepare(`
      UPDATE calltag_meta_connections
      SET last_webhook_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(connection.id).run();

    try {
      const token = await decryptProviderCredential(
        env,
        connection.credential_envelope,
        metaCredentialAad(connection.owner_id, connection.page_id),
      );
      const graphLead = await fetchMetaLead(env, event.leadgenId, token);
      const canonical = canonicalMetaLead(connection, event, graphLead);
      const result = await intakeCanonicalLead(db, connection.owner_id, canonical, {
        idempotencyKey: event.leadgenId,
        connectionId: connection.id,
      });

      if (result.created) {
        summary.imported++;
        try {
          await notifyUniversalLeadAvailable(env, db, connection.owner_id, {
            eventId: result.eventId,
            leadId: result.event?.id,
          });
        } catch (pushError) {
          console.error('CallTag Meta lead push failed', { message: text(pushError?.message || pushError, 180) });
        }
      } else {
        summary.duplicates++;
      }

      await db.prepare(`
        UPDATE calltag_meta_connections
        SET status = 'active', last_lead_at = CURRENT_TIMESTAMP, last_error = '', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(connection.id).run();
      await recordLeadAudit(db, {
        requestId,
        ownerId: connection.owner_id,
        eventId: result.eventId,
        action: 'meta.leadgen',
        result: result.result,
        sourceType: 'meta_lead_ads',
        statusCode: 200,
      });
    } catch (error) {
      summary.failed++;
      const code = text(error?.code || error?.details?.code || 'CALLTAG_META_PROCESS_FAILED', 120);
      await db.prepare(`
        UPDATE calltag_meta_connections
        SET status = 'error', last_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(safeMetaError(error), connection.id).run();
      await recordLeadAudit(db, {
        requestId,
        ownerId: connection.owner_id,
        action: 'meta.leadgen',
        result: code,
        sourceType: 'meta_lead_ads',
        statusCode: Number(error?.status || 502),
      });
    }
  }
  return summary;
}

export function canonicalMetaLead(connection = {}, webhookEvent = {}, graphLead = {}) {
  const values = fieldDataMap(graphLead?.field_data);
  const phone = firstField(values, ['phone_number', 'phone', 'mobile_number', 'mobile']);
  const email = firstField(values, ['email', 'email_address']);
  const firstName = firstField(values, ['first_name']);
  const lastName = firstField(values, ['last_name']);
  const name = firstField(values, ['full_name', 'name']) || [firstName, lastName].filter(Boolean).join(' ').trim();

  const fields = [];
  let content = '';
  let order = 1;
  for (const [key, fieldValues] of values.entries()) {
    const value = fieldValues.length <= 1 ? (fieldValues[0] || '') : fieldValues;
    fields.push({ key, label: key, value: safeFieldValue(value), order: order++ });
    if (!content && !CONTACT_FIELDS.has(key) && /message|comment|question|request|inquiry|note/i.test(key)) {
      content = Array.isArray(value) ? value.join(', ') : String(value || '');
    }
  }

  return {
    external_id: text(graphLead?.id || webhookEvent.leadgenId, 240),
    source: {
      type: 'meta_lead_ads',
      name: text(connection.page_name || 'Meta Lead Ads', 160),
      provider: 'meta',
      page_id: text(connection.page_id || webhookEvent.pageId, 160),
      form_id: text(graphLead?.form_id || webhookEvent.formId, 160),
      ad_id: text(graphLead?.ad_id || webhookEvent.adId, 160),
    },
    customer: { name, phone, email },
    inquiry: { content: text(content, 5000), fields },
    submitted_at: graphLead?.created_time || webhookEvent.createdTime || Date.now(),
    metadata: {
      provider: 'meta',
      pageId: text(connection.page_id || webhookEvent.pageId, 160),
      formId: text(graphLead?.form_id || webhookEvent.formId, 160),
      adId: text(graphLead?.ad_id || webhookEvent.adId, 160),
    },
  };
}

export function publicMetaConnection(row = {}) {
  let scopes = [];
  try { scopes = JSON.parse(String(row?.granted_scopes_json || '[]')); } catch {}
  return {
    id: String(row?.id || ''),
    pageId: String(row?.page_id || ''),
    pageName: String(row?.page_name || ''),
    status: String(row?.status || ''),
    tokenExpiresAt: String(row?.token_expires_at || ''),
    grantedScopes: Array.isArray(scopes) ? scopes : [],
    lastWebhookAt: String(row?.last_webhook_at || ''),
    lastLeadAt: String(row?.last_lead_at || ''),
    lastError: String(row?.last_error || ''),
    createdAt: String(row?.created_at || ''),
    updatedAt: String(row?.updated_at || ''),
    revokedAt: String(row?.revoked_at || ''),
  };
}

async function fetchMetaLead(env, leadgenId, token) {
  const version = graphVersion(env);
  const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(leadgenId)}`);
  url.searchParams.set('fields', 'id,created_time,ad_id,form_id,field_data');
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    const error = leadError('Meta lead details could not be retrieved.', 502, 'CALLTAG_META_GRAPH_FETCH_FAILED');
    error.metaStatus = Number(response.status || 0);
    throw error;
  }
  return body || {};
}

async function getOwnedMetaConnection(db, ownerId, connectionId) {
  return db.prepare(`
    SELECT * FROM calltag_meta_connections WHERE id = ? AND owner_id = ? LIMIT 1
  `).bind(text(connectionId, 160), ownerId).first();
}

async function readRawBodyLimited(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw leadError('Meta webhook body is too large.', 413, 'CALLTAG_META_BODY_TOO_LARGE');
  }

  const reader = request.body?.getReader?.();
  if (!reader) {
    const buffer = new Uint8Array(await request.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw leadError('Meta webhook body is too large.', 413, 'CALLTAG_META_BODY_TOO_LARGE');
    }
    return buffer;
  }

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      throw leadError('Meta webhook body is too large.', 413, 'CALLTAG_META_BODY_TOO_LARGE');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function fieldDataMap(fieldData) {
  const map = new Map();
  for (const field of Array.isArray(fieldData) ? fieldData.slice(0, 100) : []) {
    const key = String(field?.name || '').trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, '_').slice(0, 120);
    if (!key) continue;
    const values = Array.isArray(field?.values)
      ? field.values.slice(0, 50).map((value) => text(value, 5000))
      : [text(field?.values, 5000)];
    map.set(key, values.filter((value) => value !== ''));
  }
  return map;
}

function firstField(map, keys) {
  for (const key of keys) {
    const values = map.get(key);
    if (values?.length && values[0]) return values[0];
  }
  return '';
}

function graphVersion(env = {}) {
  const value = String(env.CALLTAG_META_GRAPH_VERSION || '').trim();
  return /^v\d{1,3}\.\d{1,2}$/.test(value) ? value : DEFAULT_GRAPH_VERSION;
}

function metaAppSecret(env = {}) {
  const value = String(env.CALLTAG_META_APP_SECRET || env.META_APP_SECRET || '').trim();
  if (value.length < 16) throw leadError('Meta App Secret is not configured.', 503, 'CALLTAG_META_APP_SECRET_REQUIRED');
  return value;
}

function metaVerifyToken(env = {}) {
  return String(env.CALLTAG_META_WEBHOOK_VERIFY_TOKEN || env.META_WEBHOOK_VERIFY_TOKEN || '').trim();
}

function metaCredentialAad(ownerId, pageId) {
  return `calltag:meta-page-token:v1:${ownerId}:${pageId}`;
}

function metaId(value, code) {
  const id = cleanMetaId(value);
  if (!id) throw leadError('A valid Meta Page ID is required.', 400, code);
  return id;
}

function cleanMetaId(value) {
  const id = String(value || '').trim();
  return /^[0-9]{3,40}$/.test(id) ? id : '';
}

function normalizeOptionalDate(value) {
  if (!value) return '';
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function safeMetaError(error) {
  return text(error?.message || error?.code || 'Meta connection error', 300)
    .replace(/EA[A-Za-z0-9_-]{20,}/g, '[redacted]')
    .replace(/access[_ -]?token[^\s,]*/gi, 'access_token=[redacted]');
}
