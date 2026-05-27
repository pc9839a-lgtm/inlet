export const D1_SCHEMA_TABLES = [
  'accounts',
  'projects',
  'project_members',
  'invites',
  'pages',
  'page_revisions',
  'leads',
  'events',
  'delivery_logs',
  'ai_drafts',
  'subscriptions',
  'payments',
  'ownership_transfer_requests',
  'audit_logs',
];

export const D1_INDEX_PRIORITIES = {
  leads: ['project_id', 'created_month', 'status', 'kind', 'delivery_status', 'contact_key'],
  events: ['project_id', 'created_month', 'event_type', 'dedupe_key'],
  stats: ['project_id', 'created_month', 'event_type', 'status', 'kind', 'delivery_status'],
  billing: ['project_id', 'status', 'current_period_end'],
  audit: ['project_id', 'actor_account_id', 'action', 'created_at'],
};

export function d1UnavailablePlan(type = 'records', filters = {}, extra = {}) {
  return {
    adapter: 'd1',
    indexed: true,
    fullScan: false,
    available: false,
    type,
    filters: { ...filters },
    requiredBinding: extra.requiredBinding || 'DB',
    fallbackAdapter: extra.fallbackAdapter || 'jsonl',
    activeIndexFields: Array.isArray(extra.activeIndexFields) ? extra.activeIndexFields : [],
    missingIndexFields: Array.isArray(extra.missingIndexFields) ? extra.missingIndexFields : [],
    migrationPriority: extra.migrationPriority || 'pending-runtime-binding',
  };
}

export function d1CreatedMonth(value = new Date().toISOString()) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;
  return new Date().toISOString().slice(0, 7);
}

export function d1ContactKey(record = {}) {
  const phone = String(record.phone || '').replace(/\D/g, '');
  const email = String(record.email || '').trim().toLowerCase();
  return phone || email || '';
}

export function encodeD1Json(value, fallback = {}) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

export function decodeD1Json(value, fallback = {}) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function d1Id() {
  return globalThis.crypto?.randomUUID?.() || `d1-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function encodeD1Lead(lead = {}, context = {}) {
  const createdAt = String(lead.createdAt || lead.savedAt || lead.created_at || new Date().toISOString());
  const values = {
    answers: Array.isArray(lead.answers) ? lead.answers : [],
    values: lead.values || {},
    page: lead.page || null,
    raw: lead,
  };
  return {
    id: String(lead.id || d1Id()),
    project_id: String(context.projectId || lead.projectId || lead.project?.projectId || ''),
    page_id: context.pageId || lead.pageId || null,
    page_slug: String(context.pageSlug || lead.pageSlug || lead.page?.slug || lead.project?.slug || ''),
    kind: String(lead.kind || lead.type || 'lead'),
    status: String(lead.status || 'new'),
    name: String(lead.name || lead.values?.name || ''),
    phone: String(lead.phone || lead.values?.phone || ''),
    email: String(lead.email || lead.values?.email || ''),
    contact_key: String(lead.contactKey || d1ContactKey(lead)),
    values_json: encodeD1Json(values),
    delivery_status: String(lead.deliveryStatus || lead.delivery?.status || 'pending'),
    source_url: String(lead.sourceUrl || lead.url || ''),
    created_month: d1CreatedMonth(lead.createdMonth || createdAt),
    created_at: createdAt,
    updated_at: String(lead.updatedAt || lead.updated_at || lead.savedAt || createdAt),
  };
}

export function decodeD1Lead(row = {}) {
  const values = decodeD1Json(row.values_json, {});
  const raw = values.raw && typeof values.raw === 'object' ? values.raw : {};
  return {
    ...raw,
    id: row.id,
    projectId: row.project_id,
    pageId: row.page_id || '',
    pageSlug: row.page_slug || '',
    kind: row.kind || raw.kind || raw.type || 'lead',
    type: raw.type || row.kind || 'lead',
    status: row.status || raw.status || 'new',
    name: row.name || raw.name || '',
    phone: row.phone || raw.phone || '',
    email: row.email || raw.email || '',
    contactKey: row.contact_key || raw.contactKey || '',
    values: values.values || raw.values || {},
    answers: Array.isArray(values.answers) ? values.answers : (Array.isArray(raw.answers) ? raw.answers : []),
    deliveryStatus: row.delivery_status || raw.deliveryStatus || raw.delivery?.status || 'pending',
    sourceUrl: row.source_url || raw.sourceUrl || '',
    createdMonth: row.created_month || d1CreatedMonth(row.created_at),
    createdAt: row.created_at || raw.createdAt || '',
    updatedAt: row.updated_at || raw.updatedAt || '',
  };
}

export function encodeD1Event(event = {}, context = {}) {
  const createdAt = String(event.createdAt || event.created_at || new Date().toISOString());
  return {
    id: String(event.id || d1Id()),
    project_id: String(context.projectId || event.projectId || event.project?.projectId || ''),
    page_id: context.pageId || event.pageId || null,
    page_slug: String(context.pageSlug || event.pageSlug || event.project?.slug || ''),
    event_type: String(event.eventType || event.type || ''),
    visitor_id: String(event.visitorId || event.visitor_id || ''),
    session_id: String(event.sessionId || event.session_id || ''),
    dedupe_key: String(event.dedupeKey || event.dedupe_key || ''),
    payload_json: encodeD1Json({ raw: event }),
    created_month: d1CreatedMonth(event.createdMonth || createdAt),
    created_at: createdAt,
  };
}

export function decodeD1Event(row = {}) {
  const payload = decodeD1Json(row.payload_json, {});
  const raw = payload.raw && typeof payload.raw === 'object' ? payload.raw : {};
  return {
    ...raw,
    id: row.id,
    projectId: row.project_id,
    pageId: row.page_id || '',
    pageSlug: row.page_slug || '',
    type: row.event_type || raw.type || '',
    eventType: row.event_type || raw.eventType || raw.type || '',
    visitorId: row.visitor_id || raw.visitorId || '',
    sessionId: row.session_id || raw.sessionId || '',
    dedupeKey: row.dedupe_key || raw.dedupeKey || '',
    createdMonth: row.created_month || d1CreatedMonth(row.created_at),
    createdAt: row.created_at || raw.createdAt || '',
  };
}

export function assertD1Binding(db) {
  if (!db || typeof db.prepare !== 'function') {
    const error = new Error('D1 binding is not configured.');
    error.code = 'D1_BINDING_MISSING';
    throw error;
  }
}

export async function queryD1Rows(db, sql, params = []) {
  assertD1Binding(db);
  const statement = db.prepare(sql).bind(...params);
  const result = await statement.all();
  return {
    records: Array.isArray(result?.results) ? result.results : [],
    meta: result?.meta || {},
  };
}

export async function countD1Rows(db, sql, params = []) {
  assertD1Binding(db);
  const row = await db.prepare(sql).bind(...params).first();
  return Number(row?.total || row?.count || 0);
}

export async function getD1ProjectBySlug(db, slug = '') {
  assertD1Binding(db);
  return db.prepare('SELECT * FROM projects WHERE slug = ? LIMIT 1').bind(slug).first();
}

export async function listD1Leads(db, { projectId, month, status = '', cursor = 0, limit = 50 } = {}) {
  assertD1Binding(db);
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
  const safeCursor = Math.max(0, Number(cursor || 0));
  const filters = ['project_id = ?', 'created_month = ?'];
  const params = [projectId, month];
  if (status) {
    filters.push('status = ?');
    params.push(status);
  }
  params.push(safeLimit, safeCursor);
  const result = await queryD1Rows(
    db,
    `SELECT * FROM leads WHERE ${filters.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params,
  );
  const total = await countD1Rows(db, `SELECT COUNT(*) AS total FROM leads WHERE ${filters.join(' AND ')}`, params.slice(0, -2));
  return {
    records: result.records.map(decodeD1Lead),
    total,
    nextCursor: safeCursor + result.records.length < total ? safeCursor + result.records.length : null,
    hasMore: safeCursor + result.records.length < total,
    meta: result.meta,
  };
}

export async function listD1Events(db, { projectId, month, eventType = '', cursor = 0, limit = 100 } = {}) {
  assertD1Binding(db);
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
  const safeCursor = Math.max(0, Number(cursor || 0));
  const filters = ['project_id = ?', 'created_month = ?'];
  const params = [projectId, month];
  if (eventType) {
    filters.push('event_type = ?');
    params.push(eventType);
  }
  params.push(safeLimit, safeCursor);
  const result = await queryD1Rows(
    db,
    `SELECT * FROM events WHERE ${filters.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params,
  );
  const total = await countD1Rows(db, `SELECT COUNT(*) AS total FROM events WHERE ${filters.join(' AND ')}`, params.slice(0, -2));
  return {
    records: result.records.map(decodeD1Event),
    total,
    nextCursor: safeCursor + result.records.length < total ? safeCursor + result.records.length : null,
    hasMore: safeCursor + result.records.length < total,
    meta: result.meta,
  };
}

export async function upsertD1Lead(db, lead = {}, context = {}) {
  assertD1Binding(db);
  const row = encodeD1Lead(lead, context);
  await db.prepare(`
    INSERT INTO leads (
      id, project_id, page_id, page_slug, kind, status, name, phone, email, contact_key,
      values_json, delivery_status, source_url, created_month, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      page_id = excluded.page_id,
      page_slug = excluded.page_slug,
      kind = excluded.kind,
      status = excluded.status,
      name = excluded.name,
      phone = excluded.phone,
      email = excluded.email,
      contact_key = excluded.contact_key,
      values_json = excluded.values_json,
      delivery_status = excluded.delivery_status,
      source_url = excluded.source_url,
      created_month = excluded.created_month,
      updated_at = excluded.updated_at
  `).bind(
    row.id,
    row.project_id,
    row.page_id,
    row.page_slug,
    row.kind,
    row.status,
    row.name,
    row.phone,
    row.email,
    row.contact_key,
    row.values_json,
    row.delivery_status,
    row.source_url,
    row.created_month,
    row.created_at,
    row.updated_at,
  ).run();
  return decodeD1Lead(row);
}

export async function insertD1Event(db, event = {}, context = {}) {
  assertD1Binding(db);
  const row = encodeD1Event(event, context);
  await db.prepare(`
    INSERT OR IGNORE INTO events (
      id, project_id, page_id, page_slug, event_type, visitor_id, session_id,
      dedupe_key, payload_json, created_month, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    row.id,
    row.project_id,
    row.page_id,
    row.page_slug,
    row.event_type,
    row.visitor_id,
    row.session_id,
    row.dedupe_key,
    row.payload_json,
    row.created_month,
    row.created_at,
  ).run();
  return decodeD1Event(row);
}

export async function insertD1AuditLog(db, entry = {}) {
  assertD1Binding(db);
  const id = entry.id || d1Id();
  await db.prepare(`
    INSERT INTO audit_logs (id, project_id, actor_account_id, action, target_type, target_id, ip, user_agent, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    entry.projectId || null,
    entry.actorAccountId || null,
    entry.action || '',
    entry.targetType || '',
    entry.targetId || '',
    entry.ip || '',
    entry.userAgent || '',
    JSON.stringify(entry.metadata || {}),
  ).run();
  return { id };
}
