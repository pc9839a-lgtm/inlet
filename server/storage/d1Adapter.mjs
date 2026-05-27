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
  return queryD1Rows(
    db,
    `SELECT * FROM leads WHERE ${filters.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params,
  );
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
  return queryD1Rows(
    db,
    `SELECT * FROM events WHERE ${filters.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params,
  );
}

export async function insertD1AuditLog(db, entry = {}) {
  assertD1Binding(db);
  const id = entry.id || crypto.randomUUID();
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

