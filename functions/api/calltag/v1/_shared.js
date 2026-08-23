const MAX_BODY_BYTES = 262144;
const MAX_METADATA_BYTES = 65536;

export async function ensureUniversalLeadSchema(db) {
  if (!db?.prepare) throw leadError('Lead database is not configured.', 503, 'CALLTAG_LEAD_DB_REQUIRED');

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_lead_customers (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      normalized_phone TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      first_source_type TEXT NOT NULL DEFAULT '',
      first_source_name TEXT NOT NULL DEFAULT '',
      first_source_at INTEGER NOT NULL DEFAULT 0,
      last_source_type TEXT NOT NULL DEFAULT '',
      last_source_name TEXT NOT NULL DEFAULT '',
      last_source_at INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(owner_id, normalized_phone)
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_calltag_lead_customers_owner_phone ON calltag_lead_customers(owner_id, normalized_phone)`).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_lead_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      connection_id TEXT NOT NULL DEFAULT '',
      external_id TEXT NOT NULL DEFAULT '',
      idempotency_key TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'custom_api',
      source_name TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT '',
      source_json TEXT NOT NULL DEFAULT '{}',
      customer_name TEXT NOT NULL DEFAULT '',
      customer_phone TEXT NOT NULL,
      normalized_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL DEFAULT '',
      inquiry_content TEXT NOT NULL DEFAULT '',
      inquiry_fields_json TEXT NOT NULL DEFAULT '[]',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      submitted_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACCEPTED',
      delivered_at TEXT NOT NULL DEFAULT '',
      imported_at TEXT NOT NULL DEFAULT '',
      result TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(owner_id, event_id),
      UNIQUE(owner_id, dedupe_key)
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_calltag_lead_events_owner_status_id ON calltag_lead_events(owner_id, status, id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_calltag_lead_events_owner_customer_submitted ON calltag_lead_events(owner_id, customer_id, submitted_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_calltag_lead_events_owner_source_submitted ON calltag_lead_events(owner_id, source_type, submitted_at DESC)`).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_api_keys (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      rotated_from_id TEXT NOT NULL DEFAULT '',
      last_used_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT NOT NULL DEFAULT ''
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_calltag_api_keys_owner_status ON calltag_api_keys(owner_id, status, created_at DESC)`).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_lead_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      api_key_id TEXT NOT NULL DEFAULT '',
      event_id TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT '',
      status_code INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_calltag_lead_audit_owner_created ON calltag_lead_audit(owner_id, created_at DESC)`).run();
}

export async function readJsonLimited(request, maxBytes = MAX_BODY_BYTES) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > maxBytes) throw leadError('Request body is too large.', 413, 'CALLTAG_LEAD_BODY_TOO_LARGE');

  const reader = request.body?.getReader?.();
  if (!reader) {
    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).length > maxBytes) throw leadError('Request body is too large.', 413, 'CALLTAG_LEAD_BODY_TOO_LARGE');
    return parseJson(bodyText);
  }

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      throw leadError('Request body is too large.', 413, 'CALLTAG_LEAD_BODY_TOO_LARGE');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return parseJson(new TextDecoder().decode(merged));
}

export async function authenticateLeadApiKey(request, db) {
  await ensureUniversalLeadSchema(db);
  const auth = text(request.headers.get('Authorization'), 4096);
  const rawKey = /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  if (!rawKey || !rawKey.startsWith('ctk_')) throw leadError('API key is required.', 401, 'CALLTAG_API_KEY_REQUIRED');

  const keyHash = await sha256(rawKey);
  const row = await db.prepare(`
    SELECT id, owner_id, name, key_prefix, status, last_used_at, created_at
    FROM calltag_api_keys
    WHERE key_hash = ? AND status = 'active'
    LIMIT 1
  `).bind(keyHash).first();
  if (!row?.owner_id) throw leadError('API key is invalid or revoked.', 401, 'CALLTAG_API_KEY_INVALID');

  await db.prepare(`UPDATE calltag_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(row.id).run();
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name || ''),
    keyPrefix: String(row.key_prefix || ''),
  };
}

export async function listLeadApiKeys(db, ownerId = '') {
  await ensureUniversalLeadSchema(db);
  const rows = await db.prepare(`
    SELECT id, name, key_prefix, status, last_used_at, created_at, revoked_at, rotated_from_id
    FROM calltag_api_keys
    WHERE owner_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(safeOwner(ownerId)).all();
  return (rows?.results || []).map(publicApiKey);
}

export async function createLeadApiKey(db, ownerId = '', input = {}) {
  await ensureUniversalLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const rawKey = `ctk_${randomToken(32)}`;
  const keyHash = await sha256(rawKey);
  const keyPrefix = rawKey.slice(0, 16);
  const id = `ctkey_${randomToken(12)}`;
  const name = text(input.name || 'External Lead API', 80);
  const rotatedFromId = text(input.rotatedFromId, 120);

  await db.prepare(`
    INSERT INTO calltag_api_keys (id, owner_id, name, key_prefix, key_hash, status, rotated_from_id, created_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP)
  `).bind(id, safeOwnerId, name, keyPrefix, keyHash, rotatedFromId).run();

  return {
    id,
    name,
    keyPrefix,
    apiKey: rawKey,
    status: 'active',
    warning: '이 API Key는 지금 한 번만 표시됩니다. 안전한 곳에 저장하세요.',
  };
}

export async function revokeLeadApiKey(db, ownerId = '', keyId = '') {
  await ensureUniversalLeadSchema(db);
  const result = await db.prepare(`
    UPDATE calltag_api_keys
    SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_id = ? AND status = 'active'
  `).bind(text(keyId, 120), safeOwner(ownerId)).run();
  if (!Number(result?.meta?.changes || 0)) throw leadError('API key was not found.', 404, 'CALLTAG_API_KEY_NOT_FOUND');
  return { revoked: true, keyId: text(keyId, 120) };
}

export async function rotateLeadApiKey(db, ownerId = '', keyId = '', input = {}) {
  const safeOwnerId = safeOwner(ownerId);
  const existing = await db.prepare(`
    SELECT id, name FROM calltag_api_keys WHERE id = ? AND owner_id = ? AND status = 'active' LIMIT 1
  `).bind(text(keyId, 120), safeOwnerId).first();
  if (!existing?.id) throw leadError('API key was not found.', 404, 'CALLTAG_API_KEY_NOT_FOUND');
  const created = await createLeadApiKey(db, safeOwnerId, {
    name: input.name || existing.name,
    rotatedFromId: existing.id,
  });
  await revokeLeadApiKey(db, safeOwnerId, existing.id);
  return { ...created, rotatedFromId: String(existing.id) };
}

export async function intakeCanonicalLead(db, ownerId = '', input = {}, options = {}) {
  await ensureUniversalLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const lead = normalizeCanonicalLead(input);
  const idempotencyKey = text(options.idempotencyKey || input.idempotency_key || input.idempotencyKey, 240);
  const connectionId = text(options.connectionId || input.connection_id || input.connectionId, 160);
  const dedupeKey = await canonicalDedupeKey(lead, idempotencyKey, connectionId);

  const existingEvent = await findLeadEventByDedupe(db, safeOwnerId, dedupeKey);
  if (existingEvent) {
    return {
      ok: true,
      created: false,
      result: 'DUPLICATE_IGNORED',
      event: publicLeadEvent(existingEvent),
      eventId: String(existingEvent.event_id || ''),
      customerId: String(existingEvent.customer_id || ''),
    };
  }

  const existingCustomer = await db.prepare(`
    SELECT id FROM calltag_lead_customers
    WHERE owner_id = ? AND normalized_phone = ?
    LIMIT 1
  `).bind(safeOwnerId, lead.customer.phone).first();
  const customerId = String(existingCustomer?.id || `ctcust_${randomToken(14)}`);
  const customerWasExisting = !!existingCustomer?.id;

  await db.prepare(`
    INSERT INTO calltag_lead_customers (
      id, owner_id, normalized_phone, name, email,
      first_source_type, first_source_name, first_source_at,
      last_source_type, last_source_name, last_source_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id, normalized_phone) DO UPDATE SET
      name = CASE WHEN excluded.name != '' THEN excluded.name ELSE calltag_lead_customers.name END,
      email = CASE WHEN excluded.email != '' THEN excluded.email ELSE calltag_lead_customers.email END,
      last_source_type = excluded.last_source_type,
      last_source_name = excluded.last_source_name,
      last_source_at = excluded.last_source_at,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    customerId,
    safeOwnerId,
    lead.customer.phone,
    lead.customer.name,
    lead.customer.email,
    lead.source.type,
    lead.source.name,
    lead.submittedAt,
    lead.source.type,
    lead.source.name,
    lead.submittedAt,
  ).run();

  const customer = await db.prepare(`
    SELECT id FROM calltag_lead_customers
    WHERE owner_id = ? AND normalized_phone = ? LIMIT 1
  `).bind(safeOwnerId, lead.customer.phone).first();
  const resolvedCustomerId = String(customer?.id || customerId);
  const eventId = lead.eventId || `ct_lead_${(await sha256(`${safeOwnerId}:${dedupeKey}`)).slice(0, 24)}`;
  const sourceJson = limitedJson(lead.source, MAX_METADATA_BYTES, 'CALLTAG_LEAD_SOURCE_TOO_LARGE');
  const fieldsJson = limitedJson(lead.inquiry.fields, MAX_METADATA_BYTES, 'CALLTAG_LEAD_FIELDS_TOO_LARGE');
  const metadataJson = limitedJson(lead.metadata, MAX_METADATA_BYTES, 'CALLTAG_LEAD_METADATA_TOO_LARGE');

  try {
    await db.prepare(`
      INSERT INTO calltag_lead_events (
        event_id, owner_id, customer_id, connection_id, external_id, idempotency_key, dedupe_key,
        source_type, source_name, provider, source_json,
        customer_name, customer_phone, normalized_phone, customer_email,
        inquiry_content, inquiry_fields_json, metadata_json, submitted_at,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACCEPTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      eventId,
      safeOwnerId,
      resolvedCustomerId,
      connectionId,
      lead.externalId,
      idempotencyKey,
      dedupeKey,
      lead.source.type,
      lead.source.name,
      lead.source.provider,
      sourceJson,
      lead.customer.name,
      lead.customer.phoneRaw,
      lead.customer.phone,
      lead.customer.email,
      lead.inquiry.content,
      fieldsJson,
      metadataJson,
      lead.submittedAt,
    ).run();
  } catch (error) {
    if (!/unique|constraint/i.test(String(error?.message || error || ''))) throw error;
    const duplicate = await findLeadEventByDedupe(db, safeOwnerId, dedupeKey);
    if (!duplicate) throw error;
    return {
      ok: true,
      created: false,
      result: 'DUPLICATE_IGNORED',
      event: publicLeadEvent(duplicate),
      eventId: String(duplicate.event_id || ''),
      customerId: String(duplicate.customer_id || ''),
    };
  }

  const row = await findLeadEventByDedupe(db, safeOwnerId, dedupeKey);
  return {
    ok: true,
    created: true,
    result: customerWasExisting ? 'MATCHED_EXISTING' : 'CREATED',
    event: publicLeadEvent(row),
    eventId,
    customerId: resolvedCustomerId,
  };
}

export async function listUniversalLeads(db, ownerId = '', options = {}) {
  await ensureUniversalLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const after = Math.max(0, Number(options.after || 0));
  const limit = Math.max(1, Math.min(100, Number(options.limit || 50)));
  const rows = await db.prepare(`
    SELECT * FROM calltag_lead_events
    WHERE owner_id = ? AND id > ? AND status IN ('ACCEPTED', 'DELIVERED')
    ORDER BY id ASC
    LIMIT ?
  `).bind(safeOwnerId, after, limit + 1).all();
  const all = rows?.results || [];
  const selected = all.slice(0, limit);
  const hasMore = all.length > limit;

  if (selected.length) {
    const ids = selected.map((row) => Number(row.id || 0)).filter(Boolean);
    const placeholders = ids.map(() => '?').join(',');
    if (placeholders) {
      await db.prepare(`
        UPDATE calltag_lead_events
        SET status = 'DELIVERED', delivered_at = CASE WHEN delivered_at = '' THEN CURRENT_TIMESTAMP ELSE delivered_at END, updated_at = CURRENT_TIMESTAMP
        WHERE owner_id = ? AND status = 'ACCEPTED' AND id IN (${placeholders})
      `).bind(safeOwnerId, ...ids).run();
    }
  }

  const nextAfter = selected.length ? Number(selected[selected.length - 1].id || after) : after;
  return {
    leads: selected.map(publicLeadEvent),
    nextAfter,
    hasMore,
  };
}

export async function acknowledgeUniversalLeads(db, ownerId = '', leadIds = [], status = 'IMPORTED', result = '') {
  await ensureUniversalLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const ids = Array.from(new Set((Array.isArray(leadIds) ? leadIds : [leadIds])
    .map((id) => Number(id || 0))
    .filter((id) => Number.isInteger(id) && id > 0))).slice(0, 100);
  if (!ids.length) throw leadError('leadIds is required.', 400, 'CALLTAG_LEAD_IDS_REQUIRED');
  const nextStatus = String(status || '').toUpperCase();
  if (!['IMPORTED', 'REJECTED'].includes(nextStatus)) throw leadError('ACK status must be IMPORTED or REJECTED.', 400, 'CALLTAG_LEAD_ACK_STATUS_INVALID');

  const placeholders = ids.map(() => '?').join(',');
  const importedAt = nextStatus === 'IMPORTED' ? new Date().toISOString() : '';
  const response = await db.prepare(`
    UPDATE calltag_lead_events
    SET status = ?, imported_at = ?, result = ?, updated_at = CURRENT_TIMESTAMP
    WHERE owner_id = ? AND id IN (${placeholders}) AND status IN ('ACCEPTED', 'DELIVERED')
  `).bind(nextStatus, importedAt, text(result, 500), safeOwnerId, ...ids).run();
  return { acknowledged: Number(response?.meta?.changes || 0), status: nextStatus };
}

export function canonicalLeadFromPageroQueue(row = {}) {
  const metadata = parseStoredJson(row.metadataJson || row.metadata_json, {});
  const answers = Array.isArray(metadata.answers) ? metadata.answers : [];
  const fields = answers.map((answer, index) => ({
    key: text(answer?.key || answer?.name || answer?.id || `answer_${index + 1}`, 120),
    label: text(answer?.label || answer?.question || answer?.title || answer?.name || `항목 ${index + 1}`, 160),
    value: safeFieldValue(answer?.value ?? answer?.answer ?? answer?.text ?? ''),
    order: index + 1,
  }));

  const attribution = {
    projectId: text(row.projectId || row.project_id, 160),
    pageId: text(row.pageId || row.page_id, 160),
    pageSlug: text(row.pageSlug || row.page_slug, 160),
    pageTitle: text(metadata.pageTitle, 240),
    sourceUrl: text(row.sourceUrl || row.source_url, 1000),
    campaign: text(row.campaign, 240),
    referrer: text(metadata.referrer, 1000),
    utmSource: text(metadata.utmSource, 160),
    utmMedium: text(metadata.utmMedium, 160),
    utmCampaign: text(metadata.utmCampaign, 240),
  };

  return {
    event_id: text(row.eventId || row.event_id, 240),
    external_id: text(metadata.leadId || metadata.externalId, 240),
    source: {
      type: 'pagero',
      name: text(metadata.pageTitle || row.pageSlug || row.page_slug || '페이지로', 160),
      provider: 'pagero',
      page_id: attribution.pageId,
      form_id: attribution.pageId,
      campaign_name: attribution.campaign,
    },
    customer: {
      name: text(row.customerName || row.customer_name, 120),
      phone: text(row.customerPhone || row.customer_phone, 40),
      email: text(row.customerEmail || row.customer_email, 240),
    },
    inquiry: {
      content: text(row.inquiryContent || row.inquiry_content, 5000),
      fields,
    },
    submitted_at: row.submittedAt || row.submitted_at || Date.now(),
    metadata: attribution,
  };
}

export async function recordLeadAudit(db, input = {}) {
  try {
    await ensureUniversalLeadSchema(db);
    await db.prepare(`
      INSERT INTO calltag_lead_audit (
        request_id, owner_id, api_key_id, event_id, action, result, source_type, status_code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      text(input.requestId || `req_${randomToken(10)}`, 120),
      safeOwner(input.ownerId),
      text(input.apiKeyId, 120),
      text(input.eventId, 240),
      text(input.action || 'lead.intake', 80),
      text(input.result, 80),
      text(input.sourceType, 80),
      Math.max(0, Number(input.statusCode || 0)),
    ).run();
  } catch (error) {
    console.error('CallTag lead audit failed', { message: text(error?.message || error, 180) });
  }
}

export function normalizeCanonicalLead(input = {}) {
  const sourceInput = objectValue(input.source);
  const customerInput = objectValue(input.customer);
  const inquiryInput = objectValue(input.inquiry);
  const phoneRaw = text(customerInput.phone, 40);
  const phone = normalizePhone(phoneRaw);
  if (phone.length < 8 || phone.length > 20) throw leadError('A valid customer phone number is required.', 400, 'CALLTAG_LEAD_PHONE_REQUIRED');

  const email = text(customerInput.email, 240).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw leadError('Customer email is invalid.', 400, 'CALLTAG_LEAD_EMAIL_INVALID');

  const sourceType = normalizeCode(sourceInput.type || 'custom_api', 80) || 'custom_api';
  const submittedAt = normalizeTimestamp(input.submitted_at ?? input.submittedAt);
  const fields = Array.isArray(inquiryInput.fields)
    ? inquiryInput.fields.slice(0, 100).map((field, index) => ({
        key: text(field?.key || `field_${index + 1}`, 120),
        label: text(field?.label || field?.key || `항목 ${index + 1}`, 160),
        value: safeFieldValue(field?.value),
        order: Number.isFinite(Number(field?.order)) ? Number(field.order) : index + 1,
      }))
    : [];

  return {
    eventId: text(input.event_id || input.eventId, 240),
    externalId: text(input.external_id || input.externalId, 240),
    source: {
      ...sanitizeObject(sourceInput, 30),
      type: sourceType,
      name: text(sourceInput.name || sourceType, 160),
      provider: normalizeCode(sourceInput.provider || sourceType, 80),
    },
    customer: {
      name: text(customerInput.name, 120),
      phone,
      phoneRaw,
      email,
    },
    inquiry: {
      content: text(inquiryInput.content, 5000),
      fields,
    },
    submittedAt,
    metadata: sanitizeObject(objectValue(input.metadata), 80),
  };
}

export function publicLeadEvent(row = {}) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    eventId: String(row.event_id || ''),
    externalId: String(row.external_id || ''),
    customerId: String(row.customer_id || ''),
    connectionId: String(row.connection_id || ''),
    source: parseStoredJson(row.source_json, {
      type: String(row.source_type || ''),
      name: String(row.source_name || ''),
      provider: String(row.provider || ''),
    }),
    customer: {
      name: String(row.customer_name || ''),
      phone: String(row.customer_phone || ''),
      email: String(row.customer_email || ''),
    },
    inquiry: {
      content: String(row.inquiry_content || ''),
      fields: parseStoredJson(row.inquiry_fields_json, []),
    },
    metadata: parseStoredJson(row.metadata_json, {}),
    submittedAt: Number(row.submitted_at || 0),
    status: String(row.status || 'ACCEPTED'),
    deliveredAt: String(row.delivered_at || ''),
    importedAt: String(row.imported_at || ''),
    result: String(row.result || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

export function leadError(message, status = 400, code = 'CALLTAG_LEAD_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = { code };
  return error;
}

async function canonicalDedupeKey(lead, idempotencyKey = '', connectionId = '') {
  if (lead.eventId) return `event:${lead.source.type}:${lead.eventId}`;
  if (lead.externalId) return `external:${lead.source.type}:${lead.externalId}`;
  if (idempotencyKey) return `idempotency:${idempotencyKey}`;
  const fingerprint = [connectionId, lead.source.provider, lead.source.type, lead.customer.phone, lead.submittedAt].join('|');
  return `fingerprint:${await sha256(fingerprint)}`;
}

async function findLeadEventByDedupe(db, ownerId, dedupeKey) {
  return db.prepare(`SELECT * FROM calltag_lead_events WHERE owner_id = ? AND dedupe_key = ? LIMIT 1`).bind(ownerId, dedupeKey).first();
}

function publicApiKey(row = {}) {
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    keyPrefix: String(row.key_prefix || ''),
    status: String(row.status || ''),
    lastUsedAt: String(row.last_used_at || ''),
    createdAt: String(row.created_at || ''),
    revokedAt: String(row.revoked_at || ''),
    rotatedFromId: String(row.rotated_from_id || ''),
  };
}

function parseJson(value = '') {
  if (!String(value || '').trim()) return {};
  try { return JSON.parse(value); }
  catch { throw leadError('Request JSON is invalid.', 400, 'CALLTAG_LEAD_JSON_INVALID'); }
}

function parseStoredJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); }
  catch { return fallback; }
}

function limitedJson(value, maxBytes, code) {
  let json = '';
  try { json = JSON.stringify(value ?? {}); }
  catch { throw leadError('Lead data could not be encoded.', 400, 'CALLTAG_LEAD_JSON_ENCODE_FAILED'); }
  if (new TextEncoder().encode(json).length > maxBytes) throw leadError('Lead metadata is too large.', 413, code);
  return json;
}

function normalizePhone(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function normalizeCode(value = '', max = 80) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max);
}

function normalizeTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value < 100000000000 ? Math.round(value * 1000) : Math.round(value);
  if (value) {
    const parsed = Date.parse(String(value));
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sanitizeObject(value, maxKeys = 50) {
  const result = {};
  for (const [key, item] of Object.entries(objectValue(value)).slice(0, maxKeys)) {
    result[text(key, 120)] = safeFieldValue(item);
  }
  return result;
}

function safeFieldValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.slice(0, 5000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map(safeFieldValue);
  if (typeof value === 'object') return sanitizeObject(value, 50);
  return text(value, 5000);
}

function safeOwner(value = '') {
  const ownerId = text(value, 160);
  if (!ownerId) throw leadError('Owner scope could not be resolved.', 401, 'CALLTAG_LEAD_OWNER_REQUIRED');
  return ownerId;
}

function randomToken(byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value = '') {
  const bytes = new TextEncoder().encode(String(value));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}
