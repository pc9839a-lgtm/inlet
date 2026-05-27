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

export function encodeD1Account(account = {}) {
  const now = new Date().toISOString();
  const email = String(account.email || '').trim().toLowerCase();
  return {
    id: String(account.id || account.ownerId || (email ? `user_${stableD1Hash(email)}` : d1Id())),
    email,
    phone: String(account.phone || '').replace(/\D/g, '') || null,
    name: String(account.name || email || ''),
    password_hash: String(account.passwordHash || account.password_hash || ''),
    email_verified_at: account.emailVerified === true
      ? String(account.emailVerifiedAt || account.email_verified_at || now)
      : (account.emailVerifiedAt || account.email_verified_at || null),
    status: String(account.status || 'active'),
    created_at: String(account.createdAt || account.created_at || now),
    updated_at: String(account.updatedAt || account.updated_at || now),
  };
}

export function decodeD1Account(row = {}) {
  return {
    id: row.id || '',
    ownerId: row.id || '',
    email: row.email || '',
    phone: row.phone || '',
    name: row.name || '',
    passwordHash: row.password_hash || '',
    emailVerified: !!row.email_verified_at,
    emailVerifiedAt: row.email_verified_at || '',
    status: row.status || 'active',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

export function encodeD1Invite(invite = {}, context = {}) {
  const now = new Date().toISOString();
  return {
    id: String(invite.id || d1Id()),
    project_id: String(context.projectId || invite.projectId || ''),
    email: String(invite.email || '').trim().toLowerCase(),
    phone: String(invite.phone || '').replace(/\D/g, '') || null,
    name: String(invite.name || ''),
    token_hash: String(invite.tokenHash || invite.token_hash || invite.token || ''),
    access_json: encodeD1Json(invite.access || {}, {}),
    status: String(invite.status || 'pending'),
    invited_by_account_id: String(context.invitedByAccountId || invite.invitedByAccountId || invite.invited_by_account_id || context.ownerId || ''),
    accepted_account_id: invite.acceptedAccountId || invite.accepted_account_id || null,
    expires_at: invite.expiresAt || invite.expires_at || null,
    accepted_at: invite.acceptedAt || invite.accepted_at || null,
    created_at: String(invite.invitedAt || invite.createdAt || invite.created_at || now),
    updated_at: String(invite.updatedAt || invite.updated_at || now),
  };
}

export function decodeD1Invite(row = {}) {
  return {
    id: row.id || '',
    projectId: row.project_id || '',
    email: row.email || '',
    phone: row.phone || '',
    name: row.name || '',
    token: row.token_hash || '',
    tokenHash: row.token_hash || '',
    access: decodeD1Json(row.access_json, {}),
    status: row.status || 'pending',
    invitedByAccountId: row.invited_by_account_id || '',
    acceptedAccountId: row.accepted_account_id || '',
    expiresAt: row.expires_at || '',
    acceptedAt: row.accepted_at || '',
    invitedAt: row.created_at || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

export function encodeD1ProjectMember(member = {}, context = {}) {
  const now = new Date().toISOString();
  return {
    id: String(member.id || d1Id()),
    project_id: String(context.projectId || member.projectId || ''),
    account_id: String(context.accountId || member.accountId || member.ownerId || ''),
    role: String(member.role || 'manager'),
    access_json: encodeD1Json(member.access || {}, {}),
    status: String(member.status || 'active'),
    invited_by_account_id: context.invitedByAccountId || member.invitedByAccountId || null,
    created_at: String(member.createdAt || member.acceptedAt || now),
    updated_at: String(member.updatedAt || now),
  };
}

export function decodeD1ProjectMember(row = {}) {
  return {
    id: row.id || '',
    projectId: row.project_id || '',
    accountId: row.account_id || '',
    ownerId: row.account_id || '',
    role: row.role || 'manager',
    access: decodeD1Json(row.access_json, {}),
    status: row.status || 'active',
    invitedByAccountId: row.invited_by_account_id || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

export function encodeD1Project(project = {}, context = {}) {
  const now = new Date().toISOString();
  const slug = String(context.slug || project.slug || 'my-page').replace(/[^a-zA-Z0-9-_]/g, '') || 'my-page';
  const ownerId = String(context.ownerId || project.ownerId || project.ownerAccountId || project.owner_account_id || '');
  const projectId = String(context.projectId || project.projectId || project.id || `${ownerId}_${slug}_${stableD1Hash(`${ownerId}:${slug}`)}`);
  return {
    id: projectId,
    owner_account_id: ownerId,
    slug,
    title: String(project.title || context.title || slug),
    client_email: String(project.clientEmail || project.client_email || '').trim().toLowerCase(),
    plan: String(project.plan || 'free'),
    billing_status: String(project.billingStatus || project.billing_status || 'trial'),
    status: String(project.status || 'active'),
    created_at: String(project.createdAt || project.created_at || now),
    updated_at: String(project.updatedAt || project.updated_at || now),
  };
}

export function decodeD1Project(row = {}) {
  return {
    id: row.id || '',
    projectId: row.id || '',
    ownerId: row.owner_account_id || '',
    ownerAccountId: row.owner_account_id || '',
    slug: row.slug || '',
    title: row.title || '',
    clientEmail: row.client_email || '',
    plan: row.plan || 'free',
    billingStatus: row.billing_status || 'trial',
    status: row.status || 'active',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

export function encodeD1Page(page = {}, context = {}) {
  const now = new Date().toISOString();
  const slug = String(context.slug || page.slug || 'my-page').replace(/[^a-zA-Z0-9-_]/g, '') || 'my-page';
  const projectId = String(context.projectId || page.projectId || '');
  const id = String(page.id || context.pageId || `${projectId}_${slug}_${stableD1Hash(`${projectId}:${slug}`)}`);
  const updatedAt = String(page.updatedAt || page.updated_at || now);
  return {
    id,
    project_id: projectId,
    slug,
    title: String(page.title || ''),
    page_json: encodeD1Json({ ...page, slug, projectId, updatedAt }, {}),
    revision: Math.max(1, Number(context.revision || page.revision || 1)),
    published_at: page.publishedAt || page.published_at || null,
    created_at: String(page.createdAt || page.created_at || now),
    updated_at: updatedAt,
  };
}

export function decodeD1Page(row = {}) {
  const page = decodeD1Json(row.page_json, {});
  return {
    ...page,
    id: page.id || row.id || '',
    projectId: row.project_id || page.projectId || '',
    slug: row.slug || page.slug || '',
    title: row.title || page.title || '',
    revision: Number(row.revision || page.revision || 1),
    publishedAt: row.published_at || page.publishedAt || '',
    createdAt: row.created_at || page.createdAt || '',
    updatedAt: row.updated_at || page.updatedAt || '',
  };
}

export function encodeD1PageRevision(revision = {}, context = {}) {
  const now = new Date().toISOString();
  const page = revision.page && typeof revision.page === 'object' ? revision.page : revision;
  const revisionNumber = Math.max(1, Number(context.revision || revision.revision || page.revision || 1));
  return {
    id: String(revision.id || context.id || `${context.pageId || page.id || 'page'}_${revisionNumber}_${stableD1Hash(now)}`),
    page_id: String(context.pageId || revision.pageId || page.id || ''),
    project_id: String(context.projectId || revision.projectId || page.projectId || ''),
    revision: revisionNumber,
    page_json: encodeD1Json(page, {}),
    reason: String(revision.reason || page.revisionReason || ''),
    created_by_account_id: context.createdByAccountId || revision.createdByAccountId || null,
    created_at: String(revision.revisionAt || revision.createdAt || revision.created_at || now),
  };
}

export function decodeD1PageRevision(row = {}) {
  const page = decodeD1Json(row.page_json, {});
  return {
    id: row.id || '',
    pageId: row.page_id || '',
    projectId: row.project_id || '',
    revision: Number(row.revision || 1),
    revisionAt: row.created_at || '',
    reason: row.reason || '',
    createdByAccountId: row.created_by_account_id || '',
    title: page.title || '',
    slug: page.slug || '',
    updatedAt: page.updatedAt || '',
    blocks: Array.isArray(page.blocks) ? page.blocks.length : 0,
    page,
  };
}

export function encodeD1AiDraft(draft = {}, context = {}) {
  const now = new Date().toISOString();
  const id = String(draft.id || d1Id());
  return {
    id,
    project_id: String(context.projectId || draft.projectId || ''),
    prompt_hash: String(draft.promptHash || draft.prompt_hash || stableD1Hash(draft.prompt || draft.title || id)),
    draft_json: encodeD1Json({ ...draft, id }, {}),
    status: ['created', 'applied', 'deleted'].includes(String(draft.status || '')) ? String(draft.status) : 'created',
    created_by_account_id: context.createdByAccountId || draft.createdByAccountId || null,
    created_at: String(draft.createdAt || draft.savedAt || draft.created_at || now),
  };
}

export function decodeD1AiDraft(row = {}) {
  const draft = decodeD1Json(row.draft_json, {});
  return {
    ...draft,
    id: row.id || draft.id || '',
    projectId: row.project_id || draft.projectId || '',
    promptHash: row.prompt_hash || draft.promptHash || '',
    status: row.status || draft.status || 'created',
    createdByAccountId: row.created_by_account_id || draft.createdByAccountId || '',
    createdAt: row.created_at || draft.createdAt || '',
    savedAt: draft.savedAt || row.created_at || '',
  };
}

const D1_TRANSFER_STATUSES = new Set(['requested', 'waiting_billing_clearance', 'approved', 'rejected', 'completed', 'canceled']);
const D1_BILLING_CLEARANCE_STATUSES = new Set(['not_checked', 'clear', 'active_subscription', 'past_due']);

export function encodeD1OwnershipTransferRequest(request = {}, context = {}) {
  const now = new Date().toISOString();
  const status = D1_TRANSFER_STATUSES.has(String(request.status || '')) ? String(request.status) : 'requested';
  const billingStatus = D1_BILLING_CLEARANCE_STATUSES.has(String(request.billingClearanceStatus || request.billing_clearance_status || ''))
    ? String(request.billingClearanceStatus || request.billing_clearance_status)
    : 'not_checked';
  return {
    id: String(request.id || d1Id()),
    project_id: String(context.projectId || request.projectId || request.project_id || ''),
    from_account_id: String(context.fromAccountId || request.fromAccountId || request.from_account_id || ''),
    to_account_id: String(context.toAccountId || request.toAccountId || request.to_account_id || ''),
    requested_by_account_id: String(context.requestedByAccountId || request.requestedByAccountId || request.requested_by_account_id || ''),
    approved_by_account_id: request.approvedByAccountId || request.approved_by_account_id || null,
    status,
    billing_clearance_status: billingStatus,
    note: String(request.note || ''),
    requested_at: String(request.requestedAt || request.requested_at || now),
    approved_at: request.approvedAt || request.approved_at || null,
    completed_at: request.completedAt || request.completed_at || null,
  };
}

export function decodeD1OwnershipTransferRequest(row = {}) {
  return {
    id: row.id || '',
    projectId: row.project_id || '',
    fromAccountId: row.from_account_id || '',
    toAccountId: row.to_account_id || '',
    requestedByAccountId: row.requested_by_account_id || '',
    approvedByAccountId: row.approved_by_account_id || '',
    status: row.status || 'requested',
    billingClearanceStatus: row.billing_clearance_status || 'not_checked',
    note: row.note || '',
    requestedAt: row.requested_at || '',
    approvedAt: row.approved_at || '',
    completedAt: row.completed_at || '',
  };
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
    delivery: raw.delivery || { status: row.delivery_status || raw.deliveryStatus || 'pending', summary: '', logs: [] },
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

export function encodeD1DeliveryLog(log = {}, context = {}) {
  const createdAt = String(log.at || log.createdAt || log.created_at || new Date().toISOString());
  const status = d1DeliveryLogStatus(log.status || context.deliveryStatus || 'pending', context);
  const idempotencyKey = String(log.idempotencyKey || log.idempotency_key || '');
  return {
    id: String(log.id || (idempotencyKey ? `delivery-${context.projectId}-${idempotencyKey}` : d1Id())),
    project_id: String(context.projectId || log.projectId || ''),
    lead_id: String(context.leadId || log.leadId || ''),
    provider: String(log.provider || log.target || context.provider || 'unknown'),
    target: String(log.target || ''),
    status,
    retryable: d1DeliveryRetryable(status, context) ? 1 : 0,
    attempts: Number(context.attempts || log.attempts || 0),
    idempotency_key: idempotencyKey,
    error: String(log.error || (status === 'failed' || status === 'timeout' ? log.message || '' : '')),
    next_retry_at: context.nextRetryAt || log.nextRetryAt || null,
    created_month: d1CreatedMonth(log.createdMonth || createdAt),
    created_at: createdAt,
    updated_at: String(log.updatedAt || log.updated_at || new Date().toISOString()),
  };
}

export function decodeD1DeliveryLog(row = {}) {
  return {
    id: row.id,
    projectId: row.project_id,
    leadId: row.lead_id,
    provider: row.provider || '',
    target: row.target || '',
    status: row.status || 'pending',
    deliveryStatus: d1DeliveryStatusFromLog(row.status || 'pending'),
    retryable: Number(row.retryable || 0) === 1,
    attempts: Number(row.attempts || 0),
    idempotencyKey: row.idempotency_key || '',
    error: row.error || '',
    message: row.error || '',
    nextRetryAt: row.next_retry_at || '',
    createdMonth: row.created_month || d1CreatedMonth(row.created_at),
    createdAt: row.created_at || '',
    at: row.created_at || '',
    updatedAt: row.updated_at || '',
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
  const row = await db.prepare('SELECT * FROM projects WHERE slug = ? LIMIT 1').bind(slug).first();
  return row ? decodeD1Project(row) : null;
}

export async function getD1ProjectById(db, projectId = '') {
  assertD1Binding(db);
  const row = await db.prepare('SELECT * FROM projects WHERE id = ? LIMIT 1').bind(String(projectId || '')).first();
  return row ? decodeD1Project(row) : null;
}

export async function upsertD1Project(db, project = {}, context = {}) {
  assertD1Binding(db);
  const row = encodeD1Project(project, context);
  await db.prepare(`
    INSERT INTO projects (
      id, owner_account_id, slug, title, client_email, plan, billing_status, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      owner_account_id = excluded.owner_account_id,
      slug = excluded.slug,
      title = excluded.title,
      client_email = excluded.client_email,
      plan = excluded.plan,
      billing_status = excluded.billing_status,
      status = excluded.status,
      updated_at = excluded.updated_at
  `).bind(
    row.id,
    row.owner_account_id,
    row.slug,
    row.title,
    row.client_email,
    row.plan,
    row.billing_status,
    row.status,
    row.created_at,
    row.updated_at,
  ).run();
  return decodeD1Project(row);
}

export async function listD1ProjectMembers(db, { projectId } = {}) {
  assertD1Binding(db);
  const result = await queryD1Rows(
    db,
    'SELECT * FROM project_members WHERE project_id = ? AND status <> ? ORDER BY role ASC, created_at ASC',
    [String(projectId || ''), 'removed'],
  );
  return result.records.map(decodeD1ProjectMember);
}

export async function getD1ProjectAccess(db, { projectId } = {}) {
  assertD1Binding(db);
  const project = await getD1ProjectById(db, projectId);
  if (!project) return null;
  const members = await listD1ProjectMembers(db, { projectId: project.projectId });
  const masters = members.filter((member) => member.role === 'master');
  const clients = members.filter((member) => member.role === 'client_admin');
  const managers = members.filter((member) => member.role === 'manager');
  const ownerId = masters[0]?.ownerId || project.ownerId || '';
  return {
    projectId: project.projectId,
    ownerId,
    ownerEmail: '',
    clientEmail: project.clientEmail || '',
    clientAccess: clients.length > 0 || !!project.clientEmail,
    clientOwnerIds: clients.map((member) => member.ownerId).filter(Boolean),
    managerOwnerIds: managers.map((member) => member.ownerId).filter(Boolean),
    managers: managers.map((member) => ({
      id: member.id,
      ownerId: member.ownerId,
      email: '',
      name: '',
      status: member.status === 'active' ? 'active' : 'disabled',
      access: member.access || {},
    })),
    invites: [],
    updatedAt: project.updatedAt || '',
    source: 'd1',
  };
}

export async function getD1AccountByEmail(db, email = '') {
  assertD1Binding(db);
  const row = await db.prepare('SELECT * FROM accounts WHERE email = ? LIMIT 1').bind(String(email || '').trim().toLowerCase()).first();
  return row ? decodeD1Account(row) : null;
}

export async function getD1AccountByPhone(db, phone = '') {
  assertD1Binding(db);
  const normalized = String(phone || '').replace(/\D/g, '');
  if (!normalized) return null;
  const row = await db.prepare('SELECT * FROM accounts WHERE phone = ? LIMIT 1').bind(normalized).first();
  return row ? decodeD1Account(row) : null;
}

export async function upsertD1Account(db, account = {}) {
  assertD1Binding(db);
  const row = encodeD1Account(account);
  await db.prepare(`
    INSERT INTO accounts (
      id, email, phone, name, password_hash, email_verified_at, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      phone = excluded.phone,
      name = excluded.name,
      password_hash = excluded.password_hash,
      email_verified_at = excluded.email_verified_at,
      status = excluded.status,
      updated_at = excluded.updated_at
  `).bind(
    row.id,
    row.email,
    row.phone,
    row.name,
    row.password_hash,
    row.email_verified_at,
    row.status,
    row.created_at,
    row.updated_at,
  ).run();
  return decodeD1Account(row);
}

export async function upsertD1Invite(db, invite = {}, context = {}) {
  assertD1Binding(db);
  const row = encodeD1Invite(invite, context);
  await db.prepare(`
    INSERT INTO invites (
      id, project_id, email, phone, name, token_hash, access_json, status,
      invited_by_account_id, accepted_account_id, expires_at, accepted_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      phone = excluded.phone,
      name = excluded.name,
      token_hash = excluded.token_hash,
      access_json = excluded.access_json,
      status = excluded.status,
      accepted_account_id = excluded.accepted_account_id,
      expires_at = excluded.expires_at,
      accepted_at = excluded.accepted_at,
      updated_at = excluded.updated_at
  `).bind(
    row.id,
    row.project_id,
    row.email,
    row.phone,
    row.name,
    row.token_hash,
    row.access_json,
    row.status,
    row.invited_by_account_id,
    row.accepted_account_id,
    row.expires_at,
    row.accepted_at,
    row.created_at,
    row.updated_at,
  ).run();
  return decodeD1Invite(row);
}

export async function getD1InviteByToken(db, token = '') {
  assertD1Binding(db);
  const row = await db.prepare('SELECT * FROM invites WHERE token_hash = ? LIMIT 1').bind(String(token || '')).first();
  return row ? decodeD1Invite(row) : null;
}

export async function upsertD1ProjectMember(db, member = {}, context = {}) {
  assertD1Binding(db);
  const row = encodeD1ProjectMember(member, context);
  await db.prepare(`
    INSERT INTO project_members (
      id, project_id, account_id, role, access_json, status,
      invited_by_account_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, account_id) DO UPDATE SET
      role = excluded.role,
      access_json = excluded.access_json,
      status = excluded.status,
      invited_by_account_id = excluded.invited_by_account_id,
      updated_at = excluded.updated_at
  `).bind(
    row.id,
    row.project_id,
    row.account_id,
    row.role,
    row.access_json,
    row.status,
    row.invited_by_account_id,
    row.created_at,
    row.updated_at,
  ).run();
  return decodeD1ProjectMember(row);
}

export async function replaceD1ProjectMembers(db, { projectId, roles = [], members = [] } = {}) {
  assertD1Binding(db);
  const normalizedRoles = roles.map((role) => String(role || '').trim()).filter(Boolean);
  const normalizedProjectId = String(projectId || '');
  const keepIds = members.map((member) => String(member.accountId || member.ownerId || '')).filter(Boolean);
  if (!normalizedProjectId || normalizedRoles.length === 0) return { removed: 0 };

  for (const member of members) {
    await upsertD1ProjectMember(db, member, {
      projectId: normalizedProjectId,
      accountId: member.accountId || member.ownerId,
      invitedByAccountId: member.invitedByAccountId || null,
    });
  }

  const rolePlaceholders = normalizedRoles.map(() => '?').join(', ');
  const keepClause = keepIds.length > 0 ? `AND account_id NOT IN (${keepIds.map(() => '?').join(', ')})` : '';
  const result = await db.prepare(`
    UPDATE project_members
    SET status = 'removed', updated_at = ?
    WHERE project_id = ?
      AND role IN (${rolePlaceholders})
      ${keepClause}
  `).bind(
    new Date().toISOString(),
    normalizedProjectId,
    ...normalizedRoles,
    ...keepIds,
  ).run();
  return { removed: Number(result?.meta?.changes || result?.changes || 0) };
}

export async function getD1PageBySlug(db, { projectId, slug } = {}) {
  assertD1Binding(db);
  const row = await db.prepare('SELECT * FROM pages WHERE project_id = ? AND slug = ? LIMIT 1').bind(String(projectId || ''), String(slug || '')).first();
  return row ? decodeD1Page(row) : null;
}

export async function upsertD1Page(db, page = {}, context = {}) {
  assertD1Binding(db);
  const safeSlug = String(context.slug || page.slug || 'my-page').replace(/[^a-zA-Z0-9-_]/g, '') || 'my-page';
  const current = await db.prepare('SELECT id, revision, created_at FROM pages WHERE project_id = ? AND slug = ? LIMIT 1').bind(String(context.projectId || page.projectId || ''), safeSlug).first();
  const nextRevision = Math.max(1, Number(current?.revision || 0) + 1);
  const row = encodeD1Page({ ...page, id: current?.id || page.id, createdAt: current?.created_at || page.createdAt }, { ...context, slug: safeSlug, revision: nextRevision });
  await db.prepare(`
    INSERT INTO pages (
      id, project_id, slug, title, page_json, revision, published_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, slug) DO UPDATE SET
      title = excluded.title,
      page_json = excluded.page_json,
      revision = excluded.revision,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at
  `).bind(
    row.id,
    row.project_id,
    row.slug,
    row.title,
    row.page_json,
    row.revision,
    row.published_at,
    row.created_at,
    row.updated_at,
  ).run();
  await insertD1PageRevision(db, { page: decodeD1Page(row), reason: context.reason || page.revisionReason || '' }, {
    pageId: row.id,
    projectId: row.project_id,
    revision: row.revision,
    createdByAccountId: context.createdByAccountId || null,
  });
  return decodeD1Page(row);
}

export async function insertD1PageRevision(db, revision = {}, context = {}) {
  assertD1Binding(db);
  const row = encodeD1PageRevision(revision, context);
  await db.prepare(`
    INSERT OR IGNORE INTO page_revisions (
      id, page_id, project_id, revision, page_json, reason, created_by_account_id, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    row.id,
    row.page_id,
    row.project_id,
    row.revision,
    row.page_json,
    row.reason,
    row.created_by_account_id,
    row.created_at,
  ).run();
  return decodeD1PageRevision(row);
}

export async function listD1PageRevisions(db, { projectId, slug, cursor = 0, limit = 20 } = {}) {
  assertD1Binding(db);
  const page = await db.prepare('SELECT id FROM pages WHERE project_id = ? AND slug = ? LIMIT 1').bind(String(projectId || ''), String(slug || '')).first();
  if (!page?.id) return [];
  const safeLimit = Math.max(1, Math.min(50, Number(limit || 20)));
  const safeCursor = Math.max(0, Number(cursor || 0));
  const result = await queryD1Rows(
    db,
    'SELECT * FROM page_revisions WHERE project_id = ? AND page_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [projectId, page.id, safeLimit, safeCursor],
  );
  return result.records.map(decodeD1PageRevision);
}

export async function getD1PageRevision(db, { projectId, slug, id } = {}) {
  assertD1Binding(db);
  const page = await db.prepare('SELECT id FROM pages WHERE project_id = ? AND slug = ? LIMIT 1').bind(String(projectId || ''), String(slug || '')).first();
  if (!page?.id) return null;
  const row = await db.prepare('SELECT * FROM page_revisions WHERE project_id = ? AND page_id = ? AND id = ? LIMIT 1').bind(String(projectId || ''), page.id, String(id || '')).first();
  return row ? decodeD1PageRevision(row) : null;
}

export async function listD1AiDrafts(db, { projectId, cursor = 0, limit = 20, includeDeleted = false } = {}) {
  assertD1Binding(db);
  const safeLimit = Math.max(1, Math.min(50, Number(limit || 20)));
  const safeCursor = Math.max(0, Number(cursor || 0));
  const filters = ['project_id = ?'];
  const params = [String(projectId || '')];
  if (!includeDeleted) filters.push("status <> 'deleted'");
  params.push(safeLimit, safeCursor);
  const result = await queryD1Rows(
    db,
    `SELECT * FROM ai_drafts WHERE ${filters.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params,
  );
  return result.records.map(decodeD1AiDraft);
}

export async function upsertD1AiDraft(db, draft = {}, context = {}) {
  assertD1Binding(db);
  const row = encodeD1AiDraft(draft, context);
  await db.prepare(`
    INSERT INTO ai_drafts (
      id, project_id, prompt_hash, draft_json, status, created_by_account_id, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      prompt_hash = excluded.prompt_hash,
      draft_json = excluded.draft_json,
      status = excluded.status,
      created_by_account_id = excluded.created_by_account_id
  `).bind(
    row.id,
    row.project_id,
    row.prompt_hash,
    row.draft_json,
    row.status,
    row.created_by_account_id,
    row.created_at,
  ).run();
  return decodeD1AiDraft(row);
}

export async function deleteD1AiDraft(db, { projectId, id } = {}) {
  assertD1Binding(db);
  await db.prepare("UPDATE ai_drafts SET status = 'deleted' WHERE project_id = ? AND id = ?").bind(String(projectId || ''), String(id || '')).run();
  return { id };
}

export async function upsertD1OwnershipTransferRequest(db, request = {}, context = {}) {
  assertD1Binding(db);
  const row = encodeD1OwnershipTransferRequest(request, context);
  await db.prepare(`
    INSERT INTO ownership_transfer_requests (
      id, project_id, from_account_id, to_account_id, requested_by_account_id,
      approved_by_account_id, status, billing_clearance_status, note,
      requested_at, approved_at, completed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      approved_by_account_id = excluded.approved_by_account_id,
      status = excluded.status,
      billing_clearance_status = excluded.billing_clearance_status,
      note = excluded.note,
      approved_at = excluded.approved_at,
      completed_at = excluded.completed_at
  `).bind(
    row.id,
    row.project_id,
    row.from_account_id,
    row.to_account_id,
    row.requested_by_account_id,
    row.approved_by_account_id,
    row.status,
    row.billing_clearance_status,
    row.note,
    row.requested_at,
    row.approved_at,
    row.completed_at,
  ).run();
  return decodeD1OwnershipTransferRequest(row);
}

export async function listD1OwnershipTransferRequests(db, { projectId, status = '', targetAccountId = '', cursor = 0, limit = 50 } = {}) {
  assertD1Binding(db);
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
  const safeCursor = Math.max(0, Number(cursor || 0));
  const filters = ['project_id = ?'];
  const params = [projectId];
  if (status) {
    filters.push('status = ?');
    params.push(status);
  }
  if (targetAccountId) {
    filters.push('to_account_id = ?');
    params.push(targetAccountId);
  }
  params.push(safeLimit, safeCursor);
  const result = await queryD1Rows(
    db,
    `SELECT * FROM ownership_transfer_requests WHERE ${filters.join(' AND ')} ORDER BY requested_at DESC LIMIT ? OFFSET ?`,
    params,
  );
  const total = await countD1Rows(db, `SELECT COUNT(*) AS total FROM ownership_transfer_requests WHERE ${filters.join(' AND ')}`, params.slice(0, -2));
  return {
    records: result.records.map(decodeD1OwnershipTransferRequest),
    total,
    nextCursor: safeCursor + result.records.length < total ? safeCursor + result.records.length : null,
    hasMore: safeCursor + result.records.length < total,
    meta: result.meta,
  };
}

export async function listD1Leads(db, { projectId, month, status = '', kind = '', deliveryStatus = '', q = '', cursor = 0, limit = 50 } = {}) {
  assertD1Binding(db);
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
  const safeCursor = Math.max(0, Number(cursor || 0));
  const filters = ['project_id = ?', 'created_month = ?'];
  const params = [projectId, month];
  if (status) {
    filters.push('status = ?');
    params.push(status);
  }
  if (kind) {
    filters.push('kind = ?');
    params.push(kind);
  }
  if (deliveryStatus) {
    filters.push('delivery_status = ?');
    params.push(deliveryStatus);
  }
  if (q) {
    const needle = `%${String(q).trim().toLowerCase()}%`;
    filters.push('(LOWER(name) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(email) LIKE ? OR LOWER(contact_key) LIKE ? OR LOWER(values_json) LIKE ?)');
    params.push(needle, needle, needle, needle, needle);
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

export async function getD1Lead(db, { projectId, id } = {}) {
  assertD1Binding(db);
  const row = await db.prepare('SELECT * FROM leads WHERE project_id = ? AND id = ? LIMIT 1').bind(projectId, id).first();
  return row ? decodeD1Lead(row) : null;
}

export async function findD1LeadsByContact(db, { projectId, month, phone = '', email = '', limit = 100 } = {}) {
  assertD1Binding(db);
  const normalizedPhone = String(phone || '').replace(/\D/g, '');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedPhone && !normalizedEmail) return [];
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 100)));
  const filters = ['project_id = ?', 'created_month = ?'];
  const params = [projectId, month];
  const contactFilters = [];
  if (normalizedPhone) {
    contactFilters.push('contact_key = ?', "REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '.', '') = ?");
    params.push(normalizedPhone, normalizedPhone);
  }
  if (normalizedEmail) {
    contactFilters.push('LOWER(email) = ?', 'contact_key = ?');
    params.push(normalizedEmail, normalizedEmail);
  }
  filters.push(`(${contactFilters.join(' OR ')})`);
  params.push(safeLimit);
  const result = await queryD1Rows(
    db,
    `SELECT * FROM leads WHERE ${filters.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
    params,
  );
  return result.records.map(decodeD1Lead);
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

export async function listD1DeliveryLogs(db, { projectId, month = '', leadId = '', status = '', cursor = 0, limit = 200 } = {}) {
  assertD1Binding(db);
  const safeLimit = Math.max(1, Math.min(1000, Number(limit || 200)));
  const safeCursor = Math.max(0, Number(cursor || 0));
  const filters = ['project_id = ?'];
  const params = [projectId];
  if (month) {
    filters.push('created_month = ?');
    params.push(month);
  }
  if (leadId) {
    filters.push('lead_id = ?');
    params.push(leadId);
  }
  if (status) {
    filters.push('status = ?');
    params.push(d1DeliveryLogStatus(status));
  }
  params.push(safeLimit, safeCursor);
  const result = await queryD1Rows(
    db,
    `SELECT * FROM delivery_logs WHERE ${filters.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params,
  );
  const total = await countD1Rows(db, `SELECT COUNT(*) AS total FROM delivery_logs WHERE ${filters.join(' AND ')}`, params.slice(0, -2));
  return {
    records: result.records.map(decodeD1DeliveryLog),
    total,
    nextCursor: safeCursor + result.records.length < total ? safeCursor + result.records.length : null,
    hasMore: safeCursor + result.records.length < total,
    meta: result.meta,
  };
}

export async function listD1DeliveryRetryQueue(db, { projectId, status = '', cursor = 0, limit = 200 } = {}) {
  assertD1Binding(db);
  const safeLimit = Math.max(1, Math.min(1000, Number(limit || 200)));
  const safeCursor = Math.max(0, Number(cursor || 0));
  const filters = ['project_id = ?', "(retryable = 1 OR status = 'dead-letter')"];
  const params = [projectId];
  if (status === 'dead-letter') {
    filters.push("status = 'dead-letter'");
  } else if (status) {
    filters.push('status = ?');
    params.push(d1DeliveryLogStatus(status));
  }
  params.push(safeLimit, safeCursor);
  const result = await queryD1Rows(
    db,
    `SELECT * FROM delivery_logs WHERE ${filters.join(' AND ')} ORDER BY COALESCE(next_retry_at, updated_at, created_at) DESC LIMIT ? OFFSET ?`,
    params,
  );
  const countRows = await queryD1Rows(
    db,
    `SELECT status, retryable, COUNT(*) AS total FROM delivery_logs WHERE ${filters.join(' AND ')} GROUP BY status, retryable`,
    params.slice(0, -2),
  );
  const summary = d1DeliveryQueueSummary(countRows.records);
  return {
    ...summary,
    count: result.records.length,
    entries: result.records.map(decodeD1DeliveryLog).map(d1DeliveryQueueEntry),
    nextCursor: safeCursor + result.records.length < summary.total ? safeCursor + result.records.length : null,
    hasMore: safeCursor + result.records.length < summary.total,
    meta: result.meta,
  };
}

export async function aggregateD1Stats(db, { projectId, month, dateFrom = '', dateTo = '' } = {}) {
  assertD1Binding(db);
  if (!projectId || !month) {
    return emptyD1StatsSummary(month);
  }
  const scope = d1MonthDateScope({ projectId, month, dateFrom, dateTo });

  const [eventCounts, eventTrend, leadCounts, leadTrend] = await Promise.all([
    queryD1Rows(
      db,
      `SELECT event_type,
              COUNT(DISTINCT CASE WHEN dedupe_key IS NOT NULL AND dedupe_key != '' THEN dedupe_key ELSE id END) AS total
       FROM events
       WHERE ${scope.where}
       GROUP BY event_type`,
      scope.params,
    ),
    queryD1Rows(
      db,
      `SELECT substr(datetime(created_at, '+9 hours'), 1, 10) AS day,
              COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN CASE WHEN dedupe_key IS NOT NULL AND dedupe_key != '' THEN dedupe_key ELSE id END END) AS pv,
              COUNT(DISTINCT CASE WHEN event_type = 'cta_click' THEN CASE WHEN dedupe_key IS NOT NULL AND dedupe_key != '' THEN dedupe_key ELSE id END END) AS cta
       FROM events
       WHERE ${scope.where}
       GROUP BY day
       ORDER BY day ASC`,
      scope.params,
    ),
    queryD1Rows(
      db,
      `SELECT status, kind, delivery_status, COUNT(*) AS total
       FROM leads
       WHERE ${scope.where}
       GROUP BY status, kind, delivery_status`,
      scope.params,
    ),
    queryD1Rows(
      db,
      `SELECT substr(datetime(created_at, '+9 hours'), 1, 10) AS day, COUNT(*) AS db
       FROM leads
       WHERE ${scope.where}
       GROUP BY day
       ORDER BY day ASC`,
      scope.params,
    ),
  ]);

  return buildD1StatsSummary({
    month,
    eventCounts: eventCounts.records,
    eventTrend: eventTrend.records,
    leadCounts: leadCounts.records,
    leadTrend: leadTrend.records,
  });
}

function d1MonthDateScope({ projectId, month, dateFrom = '', dateTo = '' } = {}) {
  const filters = ['project_id = ?', 'created_month = ?'];
  const params = [projectId, month];
  if (dateFrom) {
    filters.push('created_at >= ?');
    params.push(String(dateFrom));
  }
  if (dateTo) {
    filters.push('created_at <= ?');
    params.push(String(dateTo));
  }
  return { where: filters.join(' AND '), params };
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
  await syncD1DeliveryLogsForLead(db, lead, { projectId: row.project_id, leadId: row.id });
  return decodeD1Lead(row);
}

function buildD1StatsSummary({ month, eventCounts = [], eventTrend = [], leadCounts = [], leadTrend = [] } = {}) {
  const eventMap = countRowsByKey(eventCounts, 'event_type');
  const pv = Number(eventMap.page_view || 0);
  const cta = Number(eventMap.cta_click || 0);
  const link = Number(eventMap.link_click || 0);
  const formStart = Number(eventMap.form_start || 0);
  const submitAttempt = Number(eventMap.form_submit_attempt || 0) + Number(eventMap.form_submit || 0);
  const submitSuccess = Number(eventMap.form_submit_success || 0);
  const reservationAttempt = Number(eventMap.reservation_submit_attempt || 0);
  const reservationSuccess =
    Number(eventMap.reservation_submit || 0) +
    Number(eventMap.reservation_submit_success || 0) +
    Number(eventMap.reservation_success || 0);

  const statusData = {};
  const deliveryData = {};
  const typeData = { '상담': 0, '예약': 0 };
  let db = 0;
  for (const row of leadCounts || []) {
    const total = Number(row.total || 0);
    db += total;
    const status = String(row.status || '신규');
    const deliveryStatus = deliveryStatusLabel(row.delivery_status || 'none');
    const type = d1StatsLeadKind(row.kind) === 'reservation' ? '예약' : '상담';
    statusData[status] = (statusData[status] || 0) + total;
    deliveryData[deliveryStatus] = (deliveryData[deliveryStatus] || 0) + total;
    typeData[type] += total;
  }

  return {
    summary: {
      pv,
      cta,
      link,
      formStart,
      submitAttempt,
      submitSuccess,
      reservationAttempt,
      reservationSuccess,
      consultLeads: typeData['상담'],
      reservationLeads: typeData['예약'],
      db,
      conversion: percent(db, pv),
      ctaConversion: percent(db, cta),
      formStartRate: percent(formStart, pv),
      formCompletionRate: percent(submitSuccess, submitAttempt),
      reservationCompletionRate: percent(reservationSuccess, reservationAttempt),
      funnel: {
        pageViews: pv,
        ctaClicks: cta,
        linkClicks: link,
        formStarts: formStart,
        submitAttempts: submitAttempt,
        submitSuccesses: submitSuccess,
        reservationAttempts: reservationAttempt,
        reservationSuccesses: reservationSuccess,
      },
      trend: mergeD1Trend(month, eventTrend, leadTrend),
      statusData,
      deliveryData,
      typeData,
    },
    totals: {
      events: sumTotals(eventCounts),
      leads: db,
      filteredEvents: sumTotals(eventCounts),
      filteredLeads: db,
    },
  };
}

function emptyD1StatsSummary(month = '') {
  return buildD1StatsSummary({ month, eventCounts: [], eventTrend: [], leadCounts: [], leadTrend: [] });
}

function countRowsByKey(rows = [], key = '') {
  return rows.reduce((acc, row) => {
    const name = String(row?.[key] || 'unknown');
    acc[name] = (acc[name] || 0) + Number(row?.total || 0);
    return acc;
  }, {});
}

function sumTotals(rows = []) {
  return rows.reduce((sum, row) => sum + Number(row?.total || 0), 0);
}

function percent(numerator, denominator) {
  return denominator ? ((numerator / denominator) * 100).toFixed(1) : '0.0';
}

function d1StatsLeadKind(value = '') {
  return /예약|방문|방문예약|reservation|booking|reserve/i.test(String(value || '')) ? 'reservation' : 'consult';
}

function deliveryStatusLabel(status = 'none') {
  return {
    pending: '전송중',
    success: '전송완료',
    failed: '전송실패',
    partial: '일부실패',
    none: '전송없음',
  }[status] || status || '전송없음';
}

function mergeD1Trend(month = '', eventTrend = [], leadTrend = []) {
  const buckets = createMonthBuckets(month);
  const byDay = new Map(buckets.map((bucket) => [bucket.id, bucket]));
  for (const row of eventTrend || []) {
    const bucket = byDay.get(String(row.day || ''));
    if (!bucket) continue;
    bucket.pv = Number(row.pv || 0);
    bucket.cta = Number(row.cta || 0);
  }
  for (const row of leadTrend || []) {
    const bucket = byDay.get(String(row.day || ''));
    if (!bucket) continue;
    bucket.db = Number(row.db || 0);
  }
  return buckets.length ? buckets : [{ id: '', label: '', pv: 0, cta: 0, db: 0 }];
}

function createMonthBuckets(month = '') {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return [];
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  const days = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return Array.from({ length: Math.min(days, 32) }, (_, index) => {
    const day = index + 1;
    const id = `${match[1]}-${match[2]}-${String(day).padStart(2, '0')}`;
    return { id, label: `${monthIndex}/${day}`, pv: 0, cta: 0, db: 0 };
  });
}

function stableD1Hash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

export async function deleteD1Lead(db, { projectId, id } = {}) {
  assertD1Binding(db);
  await db.prepare('DELETE FROM leads WHERE project_id = ? AND id = ?').bind(projectId, id).run();
  return { id };
}

async function syncD1DeliveryLogsForLead(db, lead = {}, context = {}) {
  const logs = Array.isArray(lead.delivery?.logs) ? lead.delivery.logs : [];
  if (!logs.length) return;
  const retry = lead.delivery?.retry || {};
  const attempts = Number(retry.attempts || 0);
  const nextRetryAt = retry.nextRetryAt || '';
  const deadLetter = !!retry.deadLetter;
  for (const log of logs.slice(-50)) {
    const row = encodeD1DeliveryLog(log, {
      ...context,
      deliveryStatus: lead.delivery?.status || 'none',
      attempts,
      nextRetryAt,
      deadLetter,
    });
    await db.prepare(`
      INSERT INTO delivery_logs (
        id, project_id, lead_id, provider, target, status, retryable, attempts,
        idempotency_key, error, next_retry_at, created_month, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        retryable = excluded.retryable,
        attempts = excluded.attempts,
        error = excluded.error,
        next_retry_at = excluded.next_retry_at,
        updated_at = excluded.updated_at
    `).bind(
      row.id,
      row.project_id,
      row.lead_id,
      row.provider,
      row.target,
      row.status,
      row.retryable,
      row.attempts,
      row.idempotency_key,
      row.error,
      row.next_retry_at,
      row.created_month,
      row.created_at,
      row.updated_at,
    ).run();
  }
}

function d1DeliveryLogStatus(status = 'pending', context = {}) {
  const value = String(status || '').trim();
  if (context.deadLetter || value === 'dead-letter') return 'dead-letter';
  if (value === 'success' || value === 'sent') return 'sent';
  if (value === 'timeout') return 'timeout';
  if (value === 'failed' || value === 'partial') return 'failed';
  return 'pending';
}

function d1DeliveryStatusFromLog(status = 'pending') {
  if (status === 'sent') return 'success';
  if (status === 'timeout') return 'failed';
  if (status === 'dead-letter') return 'failed';
  return status || 'pending';
}

function d1DeliveryRetryable(status = 'pending', context = {}) {
  if (context.deadLetter || status === 'dead-letter' || status === 'sent') return false;
  return ['failed', 'timeout'].includes(status);
}

function d1DeliveryQueueSummary(rows = []) {
  const summary = { total: 0, retryable: 0, deadLetter: 0, failed: 0, partial: 0 };
  for (const row of rows || []) {
    const total = Number(row.total || 0);
    const status = String(row.status || '');
    summary.total += total;
    if (Number(row.retryable || 0) === 1) summary.retryable += total;
    if (status === 'dead-letter') summary.deadLetter += total;
    if (status === 'failed' || status === 'timeout') summary.failed += total;
  }
  return summary;
}

function d1DeliveryQueueEntry(log = {}) {
  return {
    leadId: log.leadId || '',
    leadName: '',
    leadType: '',
    deliveryStatus: log.deliveryStatus || 'pending',
    summary: log.error || '',
    attempts: Number(log.attempts || 0),
    maxAttempts: 3,
    lastAttemptAt: log.updatedAt || log.createdAt || '',
    nextRetryAt: log.nextRetryAt || '',
    deadLetter: log.status === 'dead-letter',
    deadLetterAt: log.status === 'dead-letter' ? log.updatedAt || log.createdAt || '' : '',
    canRetry: !!log.retryable,
    updatedAt: log.updatedAt || log.createdAt || '',
  };
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
