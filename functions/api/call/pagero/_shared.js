const QUEUE_STATUSES = new Set(['PENDING', 'DELIVERED', 'IMPORTED', 'REJECTED']);

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS calltag_pagero_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL,
    project_id TEXT NOT NULL DEFAULT '',
    page_id TEXT NOT NULL DEFAULT '',
    page_slug TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL,
    normalized_phone TEXT NOT NULL,
    customer_email TEXT NOT NULL DEFAULT '',
    inquiry_content TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    campaign TEXT NOT NULL DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    submitted_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'IMPORTED', 'REJECTED')),
    delivered_at TEXT NOT NULL DEFAULT '',
    imported_at TEXT NOT NULL DEFAULT '',
    result TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_calltag_pagero_owner_status_id
    ON calltag_pagero_leads(owner_id, status, id)`,
  `CREATE INDEX IF NOT EXISTS idx_calltag_pagero_project_created
    ON calltag_pagero_leads(project_id, submitted_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_calltag_pagero_phone
    ON calltag_pagero_leads(owner_id, normalized_phone, submitted_at DESC)`,
];

export async function ensurePageroLeadQueueSchema(db) {
  if (!db?.prepare) throw queueError('페이지로 고객정보 저장소가 연결되지 않았습니다.', 503, 'CALLTAG_QUEUE_DB_REQUIRED');
  for (const statement of SCHEMA_STATEMENTS) {
    await db.prepare(statement).run();
  }
}

export async function enqueuePageroLead(db, input = {}) {
  await ensurePageroLeadQueueSchema(db);
  const lead = objectValue(input.lead);
  const project = objectValue(input.project);
  const page = objectValue(input.page);
  const projectId = text(input.projectId || lead.projectId || project.projectId || project.id, 120);
  const ownerId = text(input.ownerId || project.ownerId || project.ownerAccountId, 120)
    || await projectOwnerId(db, projectId);
  const leadId = text(lead.id || input.leadId, 180);
  const phone = text(firstValue(
    lead.phone,
    lead.values?.phone,
    lead.values?.['연락처'],
    lead.values?.['전화번호'],
    lead.values?.['휴대폰번호'],
  ), 40);
  const normalizedPhone = normalizePhone(phone);

  if (!ownerId || !projectId || !leadId) {
    return { queued: false, reason: 'identity_missing' };
  }
  if (normalizedPhone.length < 8) {
    return { queued: false, reason: 'invalid_phone' };
  }

  const submittedAt = epochMillis(lead.submittedAt || lead.createdAt || input.submittedAt);
  const eventId = text(input.eventId || `pagero:${projectId}:${leadId}`, 240);
  const pageId = text(lead.pageId || page.id, 160);
  const pageSlug = text(lead.pageSlug || page.slug || project.slug, 160);
  const customerName = text(firstValue(
    lead.name,
    lead.values?.name,
    lead.values?.['이름'],
    lead.values?.['성함'],
  ), 120);
  const customerEmail = text(firstValue(
    lead.email,
    lead.values?.email,
    lead.values?.['이메일'],
  ), 180).toLowerCase();
  const inquiryContent = text(firstValue(
    lead.message,
    lead.inquiryContent,
    lead.values?.message,
    lead.values?.inquiry,
    lead.values?.['문의내용'],
    lead.values?.['문의 내용'],
    lead.values?.['상담내용'],
  ), 4000);
  const sourceUrl = text(firstValue(
    lead.sourceUrl,
    lead.source?.sourceUrl,
    lead.source?.pageUrl,
    lead.pageUrl,
    page.url,
  ), 1000);
  const campaign = text(firstValue(
    lead.utmCampaign,
    lead.utm_campaign,
    lead.source?.utmCampaign,
    lead.source?.utm_campaign,
    lead.channel,
  ), 240);
  const metadataJson = compactJson({
    pageTitle: lead.pageTitle || page.title || project.title || '',
    kind: lead.kind || lead.type || '',
    values: lead.values || {},
    answers: Array.isArray(lead.answers) ? lead.answers : [],
    source: lead.source || {},
    referrer: lead.referrer || lead.source?.referrer || '',
    utmSource: lead.utmSource || lead.utm_source || '',
    utmMedium: lead.utmMedium || lead.utm_medium || '',
    utmCampaign: lead.utmCampaign || lead.utm_campaign || '',
  }, 8192);

  await db.prepare(`
    INSERT INTO calltag_pagero_leads (
      event_id, owner_id, project_id, page_id, page_slug,
      customer_name, customer_phone, normalized_phone, customer_email,
      inquiry_content, source_url, campaign, metadata_json, submitted_at,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(event_id) DO NOTHING
  `).bind(
    eventId,
    ownerId,
    projectId,
    pageId,
    pageSlug,
    customerName,
    phone,
    normalizedPhone,
    customerEmail,
    inquiryContent,
    sourceUrl,
    campaign,
    metadataJson,
    submittedAt,
  ).run();

  const row = await db.prepare(`
    SELECT id, event_id, owner_id, project_id, page_id, page_slug,
      customer_name, customer_phone, normalized_phone, customer_email,
      inquiry_content, source_url, campaign, metadata_json, submitted_at,
      status, delivered_at, imported_at, result, created_at, updated_at
    FROM calltag_pagero_leads
    WHERE event_id = ? AND owner_id = ?
    LIMIT 1
  `).bind(eventId, ownerId).first();

  return { queued: !!row, lead: row ? queueRow(row) : null };
}

export async function listPageroLeads(db, ownerId = '', options = {}) {
  await ensurePageroLeadQueueSchema(db);
  const safeOwnerId = text(ownerId, 120);
  if (!safeOwnerId) throw queueError('콜태그 로그인 정보가 없습니다.', 401, 'CALLTAG_SESSION_REQUIRED');
  const after = Math.max(0, Number(options.after || 0));
  const limit = Math.max(1, Math.min(100, Number(options.limit || 50)));
  const result = await db.prepare(`
    SELECT id, event_id, owner_id, project_id, page_id, page_slug,
      customer_name, customer_phone, normalized_phone, customer_email,
      inquiry_content, source_url, campaign, metadata_json, submitted_at,
      status, delivered_at, imported_at, result, created_at, updated_at
    FROM calltag_pagero_leads
    WHERE owner_id = ?
      AND id > ?
      AND status IN ('PENDING', 'DELIVERED')
    ORDER BY id ASC
    LIMIT ?
  `).bind(safeOwnerId, after, limit + 1).all();

  const rows = Array.isArray(result?.results) ? result.results : [];
  const hasMore = rows.length > limit;
  const selected = rows.slice(0, limit);
  await markDelivered(db, safeOwnerId, selected.map((row) => Number(row.id)).filter((id) => id > 0));
  const records = selected.map(queueRow);
  return {
    records,
    nextAfter: records.length ? records[records.length - 1].id : after,
    hasMore,
  };
}

export async function acknowledgePageroLeads(db, ownerId = '', leadIds = [], status = 'IMPORTED', result = '') {
  await ensurePageroLeadQueueSchema(db);
  const safeOwnerId = text(ownerId, 120);
  const safeStatus = String(status || '').trim().toUpperCase();
  if (!safeOwnerId) throw queueError('콜태그 로그인 정보가 없습니다.', 401, 'CALLTAG_SESSION_REQUIRED');
  if (!['IMPORTED', 'REJECTED'].includes(safeStatus)) {
    throw queueError('지원하지 않는 문의 처리 상태입니다.', 400, 'CALLTAG_ACK_STATUS_INVALID');
  }
  const ids = uniquePositiveIds(leadIds).slice(0, 100);
  if (!ids.length) throw queueError('처리할 문의가 없습니다.', 400, 'CALLTAG_ACK_IDS_REQUIRED');
  const safeResult = text(result, 1000);
  let updated = 0;
  for (const id of ids) {
    const response = await db.prepare(`
      UPDATE calltag_pagero_leads
      SET status = ?,
          imported_at = CASE WHEN ? = 'IMPORTED' THEN CURRENT_TIMESTAMP ELSE imported_at END,
          result = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND owner_id = ? AND status IN ('PENDING', 'DELIVERED')
    `).bind(safeStatus, safeStatus, safeResult, id, safeOwnerId).run();
    updated += Number(response?.meta?.changes || 0);
  }
  return { updated, requested: ids.length, status: safeStatus };
}

export function queueError(message, status = 400, code = 'CALLTAG_QUEUE_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.details = { code };
  return error;
}

async function projectOwnerId(db, projectId = '') {
  if (!projectId) return '';
  const row = await db.prepare(`
    SELECT owner_account_id
    FROM projects
    WHERE id = ?
    LIMIT 1
  `).bind(projectId).first();
  return text(row?.owner_account_id, 120);
}

async function markDelivered(db, ownerId, ids) {
  for (const id of ids) {
    await db.prepare(`
      UPDATE calltag_pagero_leads
      SET status = 'DELIVERED',
          delivered_at = CASE WHEN delivered_at = '' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND owner_id = ? AND status = 'PENDING'
    `).bind(id, ownerId).run();
  }
}

function queueRow(row = {}) {
  return {
    id: Number(row.id || 0),
    eventId: String(row.event_id || ''),
    siteId: String(row.page_slug || row.page_id || ''),
    projectId: String(row.project_id || ''),
    customer: {
      name: String(row.customer_name || ''),
      phone: String(row.customer_phone || ''),
      normalizedPhone: String(row.normalized_phone || ''),
      email: String(row.customer_email || ''),
    },
    inquiry: {
      content: String(row.inquiry_content || ''),
      sourceUrl: String(row.source_url || ''),
      campaign: String(row.campaign || ''),
    },
    metadata: parseJson(row.metadata_json),
    submittedAt: Number(row.submitted_at || 0),
    status: String(row.status || 'PENDING'),
  };
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizePhone(value = '') {
  return String(value || '').replace(/\D/g, '').slice(0, 20);
}

function epochMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 100000000000 ? Math.round(value) : Math.round(value * 1000);
  }
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function compactJson(value, maxLength) {
  try {
    const json = JSON.stringify(value || {});
    return json.length <= maxLength ? json : JSON.stringify({ truncated: true, preview: json.slice(0, maxLength - 64) });
  } catch {
    return '{}';
  }
}

function parseJson(value) {
  try {
    return JSON.parse(String(value || '{}'));
  } catch {
    return {};
  }
}

function uniquePositiveIds(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)));
}

export const PAGER0_QUEUE_STATUSES = QUEUE_STATUSES;
