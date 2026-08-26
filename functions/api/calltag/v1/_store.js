import { ensureUniversalLeadSchema } from './_schema.js';
import {
  MAX_METADATA_BYTES,
  canonicalDedupeKey,
  leadError,
  limitedJson,
  normalizeCanonicalLead,
  parseStoredJson,
  randomToken,
  safeFieldValue,
  safeOwner,
  sha256,
  text,
} from './_utils.js';

export async function intakeCanonicalLead(db, ownerId = '', input = {}, options = {}) {
  await ensureUniversalLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const lead = normalizeCanonicalLead(input);
  const idempotencyKey = text(options.idempotencyKey || input?.idempotency_key || input?.idempotencyKey, 240);
  const connectionId = text(options.connectionId || input?.connection_id || input?.connectionId, 160)
    || `source:${lead.source.provider || lead.source.type}`;
  const dedupeKey = await canonicalDedupeKey(lead, idempotencyKey, connectionId);

  // Validate all serializable payloads before creating/updating a customer row.
  const sourceJson = limitedJson(lead.source, MAX_METADATA_BYTES, 'CALLTAG_LEAD_SOURCE_TOO_LARGE');
  const fieldsJson = limitedJson(lead.inquiry.fields, MAX_METADATA_BYTES, 'CALLTAG_LEAD_FIELDS_TOO_LARGE');
  const metadataJson = limitedJson(lead.metadata, MAX_METADATA_BYTES, 'CALLTAG_LEAD_METADATA_TOO_LARGE');

  const existingEvent = await findLeadEventByDedupe(db, safeOwnerId, dedupeKey);
  if (existingEvent) return duplicateResult(existingEvent);

  const existingCustomer = await db.prepare(`
    SELECT id FROM calltag_lead_customers
    WHERE owner_id = ? AND normalized_phone = ?
    LIMIT 1
  `).bind(safeOwnerId, lead.customer.phone).first();
  const generatedCustomerId = `ctcust_${randomToken(14)}`;
  const customerId = String(existingCustomer?.id || generatedCustomerId);

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
  const customerWasExisting = !!existingCustomer?.id || resolvedCustomerId !== generatedCustomerId;
  const eventId = lead.eventId || `ct_lead_${(await sha256(`${safeOwnerId}:${dedupeKey}`)).slice(0, 24)}`;

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
    return duplicateResult(duplicate);
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
        SET status = 'DELIVERED',
            delivered_at = CASE WHEN delivered_at = '' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE owner_id = ? AND status = 'ACCEPTED' AND id IN (${placeholders})
      `).bind(safeOwnerId, ...ids).run();
    }
  }

  const nextAfter = selected.length ? Number(selected[selected.length - 1].id || after) : after;
  return { leads: selected.map(publicLeadEvent), nextAfter, hasMore };
}

export async function acknowledgeUniversalLeads(db, ownerId = '', leadIds = [], status = 'IMPORTED', result = '') {
  await ensureUniversalLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const ids = Array.from(new Set((Array.isArray(leadIds) ? leadIds : [leadIds])
    .map((id) => Number(id || 0))
    .filter((id) => Number.isInteger(id) && id > 0))).slice(0, 100);
  if (!ids.length) throw leadError('leadIds is required.', 400, 'CALLTAG_LEAD_IDS_REQUIRED');

  const nextStatus = String(status || '').toUpperCase();
  if (!['IMPORTED', 'REJECTED'].includes(nextStatus)) {
    throw leadError('ACK status must be IMPORTED or REJECTED.', 400, 'CALLTAG_LEAD_ACK_STATUS_INVALID');
  }

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
  const fields = answers.slice(0, 100).map((answer, index) => ({
    key: text(answer?.key || answer?.name || answer?.id || `answer_${index + 1}`, 120),
    label: text(answer?.label || answer?.question || answer?.title || answer?.name || `항목 ${index + 1}`, 160),
    value: safeFieldValue(answer?.value ?? answer?.answer ?? answer?.text ?? ''),
    order: index + 1,
  }));

  const attribution = {
    projectId: text(row.projectId || row.project_id, 160),
    pageId: text(row.pageId || row.page_id, 160),
    pageSlug: text(row.pageSlug || row.page_slug || row.siteId, 160),
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
      name: text(metadata.pageTitle || attribution.pageSlug || '페이지로', 160),
      provider: 'pagero',
      page_id: attribution.pageId,
      form_id: attribution.pageId,
      campaign_name: attribution.campaign,
    },
    customer: {
      name: text(row.customerName || row.customer_name || row.customer?.name, 120),
      phone: text(row.customerPhone || row.customer_phone || row.customer?.phone, 40),
      email: text(row.customerEmail || row.customer_email || row.customer?.email, 240),
    },
    inquiry: {
      content: text(row.inquiryContent || row.inquiry_content || row.inquiry?.content, 5000),
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

async function findLeadEventByDedupe(db, ownerId, dedupeKey) {
  return db.prepare(`
    SELECT * FROM calltag_lead_events
    WHERE owner_id = ? AND dedupe_key = ?
    LIMIT 1
  `).bind(ownerId, dedupeKey).first();
}

function duplicateResult(row) {
  return {
    ok: true,
    created: false,
    result: 'DUPLICATE_IGNORED',
    event: publicLeadEvent(row),
    eventId: String(row?.event_id || ''),
    customerId: String(row?.customer_id || ''),
  };
}
