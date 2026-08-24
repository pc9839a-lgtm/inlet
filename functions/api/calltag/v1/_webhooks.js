import { intakeCanonicalLead, recordLeadAudit } from './_store.js';
import {
  applyWebhookMapping,
  normalizeWebhookMapping,
  suggestWebhookMapping,
  validateWebhookMapping,
  webhookMappingReady,
} from './_mapper.js';
import { cleanupExpiredWebhookPayloads, ensureWebhookSchema } from './_webhook-schema.js';
import {
  MAX_BODY_BYTES,
  leadError,
  limitedJson,
  parseStoredJson,
  randomToken,
  readJsonLimited,
  safeOwner,
  sha256,
  text,
} from './_utils.js';

const WEBHOOK_PREFIX = 'ctwh_';
const DEFAULT_RETENTION_DAYS = 7;
const MAX_RETENTION_DAYS = 30;
const MAX_WEBHOOKS_PER_MINUTE = 300;

export async function createWebhookConnection(db, ownerId = '', input = {}) {
  await ensureWebhookSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const id = `ctconn_${randomToken(14)}`;
  const endpointKey = `${WEBHOOK_PREFIX}${randomToken(24)}`;
  const endpointHash = await sha256(endpointKey);
  const name = text(input.name || input.sourceName || 'Webhook', 120) || 'Webhook';
  const sourceName = text(input.sourceName || name, 160) || name;
  const retentionDays = normalizeRetentionDays(input.rawRetentionDays);

  let mapping = {};
  let mappingVersion = 0;
  if (input.mapping && typeof input.mapping === 'object') {
    mapping = validateWebhookMapping(input.mapping);
    mappingVersion = 1;
  }
  const mappingJson = limitedJson(mapping, 32768, 'CALLTAG_WEBHOOK_MAPPING_TOO_LARGE');

  await db.prepare(`
    INSERT INTO calltag_webhook_connections (
      id, owner_id, name, source_name, source_type,
      endpoint_prefix, endpoint_hash, status,
      mapping_version, mapping_json, raw_retention_days,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'custom_webhook', ?, ?, 'active', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    id,
    safeOwnerId,
    name,
    sourceName,
    endpointKey.slice(0, 13),
    endpointHash,
    mappingVersion,
    mappingJson,
    retentionDays,
  ).run();

  if (mappingVersion > 0) {
    await db.prepare(`
      INSERT INTO calltag_webhook_mapping_versions (
        connection_id, owner_id, version, mapping_json, created_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(id, safeOwnerId, mappingVersion, mappingJson).run();
  }

  const row = await getWebhookConnectionRow(db, safeOwnerId, id);
  return {
    connection: publicWebhookConnection(row),
    endpointKey,
    endpointPath: `/api/calltag/v1/hooks/${endpointKey}`,
  };
}

export async function listWebhookConnections(db, ownerId = '') {
  await ensureWebhookSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  await cleanupExpiredWebhookPayloads(db);
  const result = await db.prepare(`
    SELECT * FROM calltag_webhook_connections
    WHERE owner_id = ?
    ORDER BY created_at DESC, id DESC
  `).bind(safeOwnerId).all();
  return (result?.results || []).map(publicWebhookConnection);
}

export async function updateWebhookMapping(db, ownerId = '', connectionId = '', input = {}) {
  await ensureWebhookSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const current = await requireOwnedWebhookConnection(db, safeOwnerId, connectionId);
  if (String(current.status || '') !== 'active') {
    throw leadError('Webhook connection is revoked.', 409, 'CALLTAG_WEBHOOK_CONNECTION_REVOKED');
  }
  const mapping = validateWebhookMapping(input.mapping || input);
  const mappingJson = limitedJson(mapping, 32768, 'CALLTAG_WEBHOOK_MAPPING_TOO_LARGE');
  const nextVersion = Math.max(1, Number(current.mapping_version || 0) + 1);

  await db.prepare(`
    INSERT INTO calltag_webhook_mapping_versions (
      connection_id, owner_id, version, mapping_json, created_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(current.id, safeOwnerId, nextVersion, mappingJson).run();

  await db.prepare(`
    UPDATE calltag_webhook_connections
    SET mapping_version = ?, mapping_json = ?, last_error = '', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_id = ?
  `).bind(nextVersion, mappingJson, current.id, safeOwnerId).run();

  return publicWebhookConnection(await getWebhookConnectionRow(db, safeOwnerId, current.id));
}

export async function rotateWebhookEndpoint(db, ownerId = '', connectionId = '') {
  await ensureWebhookSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const current = await requireOwnedWebhookConnection(db, safeOwnerId, connectionId);
  if (String(current.status || '') !== 'active') {
    throw leadError('Webhook connection is revoked.', 409, 'CALLTAG_WEBHOOK_CONNECTION_REVOKED');
  }
  const endpointKey = `${WEBHOOK_PREFIX}${randomToken(24)}`;
  const endpointHash = await sha256(endpointKey);
  await db.prepare(`
    UPDATE calltag_webhook_connections
    SET endpoint_prefix = ?, endpoint_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_id = ?
  `).bind(endpointKey.slice(0, 13), endpointHash, current.id, safeOwnerId).run();
  return {
    connection: publicWebhookConnection(await getWebhookConnectionRow(db, safeOwnerId, current.id)),
    endpointKey,
    endpointPath: `/api/calltag/v1/hooks/${endpointKey}`,
  };
}

export async function revokeWebhookConnection(db, ownerId = '', connectionId = '') {
  await ensureWebhookSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  await requireOwnedWebhookConnection(db, safeOwnerId, connectionId);
  await db.prepare(`
    UPDATE calltag_webhook_connections
    SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_id = ?
  `).bind(text(connectionId, 160), safeOwnerId).run();
  return publicWebhookConnection(await getWebhookConnectionRow(db, safeOwnerId, connectionId));
}

export async function setWebhookRetention(db, ownerId = '', connectionId = '', rawRetentionDays = DEFAULT_RETENTION_DAYS) {
  await ensureWebhookSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  await requireOwnedWebhookConnection(db, safeOwnerId, connectionId);
  const days = normalizeRetentionDays(rawRetentionDays);
  await db.prepare(`
    UPDATE calltag_webhook_connections
    SET raw_retention_days = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_id = ?
  `).bind(days, text(connectionId, 160), safeOwnerId).run();
  return publicWebhookConnection(await getWebhookConnectionRow(db, safeOwnerId, connectionId));
}

export async function getWebhookSamples(db, ownerId = '', connectionId = '', options = {}) {
  await ensureWebhookSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const connection = await requireOwnedWebhookConnection(db, safeOwnerId, connectionId);
  await cleanupExpiredWebhookPayloads(db);
  const limit = Math.max(1, Math.min(10, Number(options.limit || 3)));
  const result = await db.prepare(`
    SELECT id, request_id, payload_json, mapping_version, status,
      canonical_event_id, error_code, error_message, received_at, expires_at
    FROM calltag_webhook_raw_events
    WHERE owner_id = ? AND connection_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).bind(safeOwnerId, connection.id, limit).all();

  return {
    connection: publicWebhookConnection(connection),
    samples: (result?.results || []).map((row) => {
      const payload = parseStoredJson(row.payload_json, {});
      return {
        id: Number(row.id || 0),
        requestId: String(row.request_id || ''),
        payload,
        mappingVersion: Number(row.mapping_version || 0),
        status: String(row.status || ''),
        canonicalEventId: String(row.canonical_event_id || ''),
        errorCode: String(row.error_code || ''),
        errorMessage: String(row.error_message || ''),
        receivedAt: String(row.received_at || ''),
        expiresAt: String(row.expires_at || ''),
        mapper: suggestWebhookMapping(payload),
      };
    }),
  };
}

export async function receiveGenericWebhook(request, db, endpointKey = '') {
  await ensureWebhookSchema(db);
  const supplied = String(endpointKey || '').trim();
  if (!supplied.startsWith(WEBHOOK_PREFIX) || supplied.length < 24 || supplied.length > 120) {
    throw leadError('Webhook endpoint was not found.', 404, 'CALLTAG_WEBHOOK_NOT_FOUND');
  }
  const endpointHash = await sha256(supplied);
  const connection = await db.prepare(`
    SELECT * FROM calltag_webhook_connections
    WHERE endpoint_hash = ? AND status = 'active'
    LIMIT 1
  `).bind(endpointHash).first();
  if (!connection?.id) throw leadError('Webhook endpoint was not found.', 404, 'CALLTAG_WEBHOOK_NOT_FOUND');

  await cleanupExpiredWebhookPayloads(db);
  await assertWebhookRateLimit(db, connection.id);

  const payload = await readJsonLimited(request, MAX_BODY_BYTES);
  const payloadJson = limitedJson(payload, MAX_BODY_BYTES, 'CALLTAG_WEBHOOK_BODY_TOO_LARGE');
  const payloadSha = await sha256(payloadJson);
  const requestId = `${text(request.headers.get('CF-Ray') || 'webhook', 80)}:${randomToken(6)}`;
  const receivedAt = new Date().toISOString();
  const retentionDays = normalizeRetentionDays(connection.raw_retention_days);
  const expiresAt = new Date(Date.now() + retentionDays * 86400000).toISOString();
  const idempotencyKey = webhookIdempotencyKey(request, payloadSha);
  const mapping = parseStoredJson(connection.mapping_json, {});
  const mappingVersion = Number(connection.mapping_version || 0);

  const inserted = await db.prepare(`
    INSERT INTO calltag_webhook_raw_events (
      request_id, connection_id, owner_id, idempotency_key,
      payload_sha256, payload_json, mapping_version, status,
      received_at, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    requestId,
    connection.id,
    connection.owner_id,
    idempotencyKey,
    payloadSha,
    payloadJson,
    mappingVersion,
    receivedAt,
    expiresAt,
  ).run();
  const rawId = Number(inserted?.meta?.last_row_id || 0);

  await db.prepare(`
    UPDATE calltag_webhook_connections
    SET sample_count = sample_count + 1,
        last_received_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(receivedAt, connection.id).run();

  if (!webhookMappingReady(mapping)) {
    await markRawEvent(db, rawId, 'MAPPING_REQUIRED', {
      errorCode: 'CALLTAG_WEBHOOK_MAPPING_REQUIRED',
      errorMessage: '필드 매핑이 필요합니다.',
    });
    return {
      ok: true,
      received: true,
      status: 'MAPPING_REQUIRED',
      requestId,
      connectionId: connection.id,
    };
  }

  try {
    const canonical = applyWebhookMapping(payload, mapping, connection);
    const result = await intakeCanonicalLead(db, connection.owner_id, canonical, {
      idempotencyKey,
      connectionId: connection.id,
    });
    await markRawEvent(db, rawId, 'MAPPED', { canonicalEventId: result.eventId });
    await db.prepare(`
      UPDATE calltag_webhook_connections
      SET last_mapped_at = CURRENT_TIMESTAMP, last_error = '', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(connection.id).run();
    await recordLeadAudit(db, {
      requestId,
      ownerId: connection.owner_id,
      eventId: result.eventId,
      action: 'webhook.intake',
      result: result.result,
      sourceType: 'custom_webhook',
      statusCode: 202,
    });
    return {
      ok: true,
      received: true,
      status: 'MAPPED',
      requestId,
      eventId: result.eventId,
      result: result.result,
    };
  } catch (error) {
    const code = text(error?.code || error?.details?.code || 'CALLTAG_WEBHOOK_MAPPING_FAILED', 120);
    const message = safeWebhookErrorMessage(error);
    await markRawEvent(db, rawId, 'REJECTED', { errorCode: code, errorMessage: message });
    await db.prepare(`
      UPDATE calltag_webhook_connections
      SET last_error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(message, connection.id).run();
    await recordLeadAudit(db, {
      requestId,
      ownerId: connection.owner_id,
      action: 'webhook.intake',
      result: code,
      sourceType: 'custom_webhook',
      statusCode: 202,
    });
    return {
      ok: true,
      received: true,
      status: 'REJECTED',
      requestId,
    };
  }
}

export async function replayWebhookRawEvent(db, ownerId = '', connectionId = '', rawEventId = 0) {
  await ensureWebhookSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const connection = await requireOwnedWebhookConnection(db, safeOwnerId, connectionId);
  const mapping = validateWebhookMapping(parseStoredJson(connection.mapping_json, {}));
  const raw = await db.prepare(`
    SELECT * FROM calltag_webhook_raw_events
    WHERE id = ? AND owner_id = ? AND connection_id = ?
    LIMIT 1
  `).bind(Number(rawEventId || 0), safeOwnerId, connection.id).first();
  if (!raw?.id) throw leadError('Webhook sample was not found.', 404, 'CALLTAG_WEBHOOK_SAMPLE_NOT_FOUND');

  const payload = parseStoredJson(raw.payload_json, {});
  const canonical = applyWebhookMapping(payload, mapping, connection);
  const idempotencyKey = text(raw.idempotency_key, 240) || `payload:${String(raw.payload_sha256 || '')}`;
  const result = await intakeCanonicalLead(db, safeOwnerId, canonical, {
    idempotencyKey,
    connectionId: connection.id,
  });
  await markRawEvent(db, Number(raw.id), 'MAPPED', { canonicalEventId: result.eventId });
  await db.prepare(`
    UPDATE calltag_webhook_connections
    SET last_mapped_at = CURRENT_TIMESTAMP, last_error = '', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(connection.id).run();
  return {
    ok: true,
    rawEventId: Number(raw.id),
    eventId: result.eventId,
    customerId: result.customerId,
    result: result.result,
  };
}

export function publicWebhookConnection(row = {}) {
  return {
    id: String(row?.id || ''),
    name: String(row?.name || ''),
    sourceName: String(row?.source_name || ''),
    sourceType: String(row?.source_type || 'custom_webhook'),
    endpointPrefix: String(row?.endpoint_prefix || ''),
    status: String(row?.status || 'active'),
    mappingVersion: Number(row?.mapping_version || 0),
    mapping: normalizeWebhookMapping(parseStoredJson(row?.mapping_json, {})),
    mappingReady: webhookMappingReady(parseStoredJson(row?.mapping_json, {})),
    rawRetentionDays: Number(row?.raw_retention_days || DEFAULT_RETENTION_DAYS),
    sampleCount: Number(row?.sample_count || 0),
    lastReceivedAt: String(row?.last_received_at || ''),
    lastMappedAt: String(row?.last_mapped_at || ''),
    lastError: String(row?.last_error || ''),
    createdAt: String(row?.created_at || ''),
    updatedAt: String(row?.updated_at || ''),
    revokedAt: String(row?.revoked_at || ''),
  };
}

async function requireOwnedWebhookConnection(db, ownerId, connectionId) {
  const row = await getWebhookConnectionRow(db, ownerId, connectionId);
  if (!row?.id) throw leadError('Webhook connection was not found.', 404, 'CALLTAG_WEBHOOK_CONNECTION_NOT_FOUND');
  return row;
}

async function getWebhookConnectionRow(db, ownerId, connectionId) {
  return db.prepare(`
    SELECT * FROM calltag_webhook_connections
    WHERE owner_id = ? AND id = ?
    LIMIT 1
  `).bind(safeOwner(ownerId), text(connectionId, 160)).first();
}

async function markRawEvent(db, rawId, status, input = {}) {
  if (!rawId) return;
  await db.prepare(`
    UPDATE calltag_webhook_raw_events
    SET status = ?, canonical_event_id = ?, error_code = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    String(status || 'RECEIVED'),
    text(input.canonicalEventId, 240),
    text(input.errorCode, 120),
    text(input.errorMessage, 500),
    Number(rawId),
  ).run();
}

async function assertWebhookRateLimit(db, connectionId) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM calltag_webhook_raw_events
    WHERE connection_id = ?
      AND datetime(received_at) >= datetime('now', '-1 minute')
  `).bind(text(connectionId, 160)).first();
  if (Number(row?.count || 0) >= MAX_WEBHOOKS_PER_MINUTE) {
    throw leadError('Webhook request rate is too high.', 429, 'CALLTAG_WEBHOOK_RATE_LIMITED');
  }
}

function webhookIdempotencyKey(request, payloadSha = '') {
  for (const header of ['Idempotency-Key', 'X-Webhook-Id', 'X-Delivery-Id', 'X-Request-Id', 'X-Event-Id']) {
    const value = text(request.headers.get(header), 240);
    if (value) return `${header.toLowerCase()}:${value}`;
  }
  return `payload:${String(payloadSha || '').slice(0, 64)}`;
}

function normalizeRetentionDays(value) {
  const parsed = Number(value || DEFAULT_RETENTION_DAYS);
  if (!Number.isFinite(parsed)) return DEFAULT_RETENTION_DAYS;
  return Math.max(1, Math.min(MAX_RETENTION_DAYS, Math.round(parsed)));
}

function safeWebhookErrorMessage(error) {
  const code = String(error?.code || error?.details?.code || '');
  if (code === 'CALLTAG_WEBHOOK_MAPPED_PHONE_INVALID') return '전화번호 필드 값을 확인해주세요.';
  if (code === 'CALLTAG_LEAD_EMAIL_INVALID') return '이메일 필드 값을 확인해주세요.';
  if (code === 'CALLTAG_WEBHOOK_MAPPING_PHONE_REQUIRED') return '전화번호 필드 매핑이 필요합니다.';
  return 'Webhook 데이터를 고객 문의로 변환하지 못했습니다.';
}
