import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  encodeD1DeliveryLog,
  encodeD1Event,
  encodeD1Lead,
  encodeD1Page,
  encodeD1Project,
} from '../server/storage/d1Adapter.mjs';

const rootDir = process.cwd();
const dataDir = path.resolve(rootDir, process.env.INLET_DATA_DIR || 'server/data');
const writeEnabled = process.env.INLET_D1_BACKFILL_WRITE === '1';
const approval = String(process.env.INLET_D1_BACKFILL_APPROVAL || '');
const rollbackAck = String(process.env.INLET_D1_BACKFILL_ROLLBACK_ACK || '');
const allowExistingIds = process.env.INLET_D1_BACKFILL_ALLOW_EXISTING_IDS === '1';
const batchSize = Math.max(1, Math.min(50, Number(process.env.INLET_D1_BACKFILL_BATCH_SIZE || 25)));
const maxRows = Math.max(1, Number(process.env.INLET_D1_BACKFILL_MAX_ROWS || 2000));
const importTag = String(process.env.INLET_D1_BACKFILL_TAG || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14));

function parseJson(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function readJson(file, fallback = null) {
  try {
    return parseJson(await readFile(file, 'utf8'), fallback);
  } catch {
    return fallback;
  }
}

async function readJsonl(file) {
  const rows = [];
  let invalid = 0;
  try {
    const info = await stat(file);
    if (!info.isFile()) return { rows, invalid, exists: false };
    const raw = await readFile(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const item = parseJson(line);
      if (item && typeof item === 'object') rows.push(item);
      else invalid += 1;
    }
    return { rows, invalid, exists: true };
  } catch {
    return { rows, invalid, exists: false };
  }
}

async function listDirs(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function listJsonFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

function safeId(value = '', fallback = '') {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || fallback;
}

function projectShell(projectId = 'singleton', page = null) {
  const slug = safeId(page?.slug || projectId || 'singleton', 'singleton');
  const ownerId = safeId(page?.ownerId || page?.ownerAccountId || `backfill_${projectId}`, `backfill_${projectId}`);
  return encodeD1Project({
    projectId,
    ownerId,
    ownerAccountId: ownerId,
    slug,
    title: page?.title || slug,
    status: 'active',
    plan: 'free',
    billingStatus: 'trial',
  }, { projectId, ownerId, slug });
}

async function loadProject(projectId, dir) {
  const pageFiles = await listJsonFiles(path.join(dir, 'pages'));
  const pages = [];
  for (const file of pageFiles) {
    const page = await readJson(file, null);
    if (page && typeof page === 'object') pages.push(page);
  }
  const leads = await readJsonl(path.join(dir, 'leads.jsonl'));
  const events = await readJsonl(path.join(dir, 'events.jsonl'));
  return { projectId, dir, pages, leads, events };
}

async function loadSingleton() {
  const pageFiles = await listJsonFiles(path.join(dataDir, 'pages'));
  const pages = [];
  for (const file of pageFiles) {
    const page = await readJson(file, null);
    if (page && typeof page === 'object') pages.push(page);
  }
  return {
    projectId: 'singleton',
    dir: dataDir,
    pages,
    leads: await readJsonl(path.join(dataDir, 'leads.jsonl')),
    events: await readJsonl(path.join(dataDir, 'events.jsonl')),
  };
}

async function loadProjects() {
  const projectsRoot = path.join(dataDir, 'projects');
  const projects = [await loadSingleton()];
  for (const projectId of await listDirs(projectsRoot)) {
    projects.push(await loadProject(projectId, path.join(projectsRoot, projectId)));
  }
  return projects;
}

function makeSql(kind, row) {
  if (kind === 'account') {
    return {
      sql: `INSERT OR IGNORE INTO accounts (id, email, phone, name, password_hash, email_verified_at, status, created_at, updated_at) VALUES (?, ?, NULL, ?, '', ?, 'active', ?, ?)`,
      params: [row.id, `${row.id}@backfill.inlet.local`, row.id, row.now, row.now, row.now],
    };
  }
  if (kind === 'project') {
    return {
      sql: `INSERT OR IGNORE INTO projects (id, owner_account_id, slug, title, client_email, plan, billing_status, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [row.id, row.owner_account_id, row.slug, row.title, row.client_email, row.plan, row.billing_status, row.status, row.created_at, row.updated_at],
    };
  }
  if (kind === 'page') {
    return {
      sql: `INSERT OR IGNORE INTO pages (id, project_id, slug, title, page_json, revision, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [row.id, row.project_id, row.slug, row.title, row.page_json, row.revision, row.published_at, row.created_at, row.updated_at],
    };
  }
  if (kind === 'lead') {
    return {
      sql: `INSERT OR IGNORE INTO leads (id, project_id, page_id, page_slug, kind, status, name, phone, email, contact_key, values_json, delivery_status, source_url, created_month, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [row.id, row.project_id, row.page_id, row.page_slug, row.kind, row.status, row.name, row.phone, row.email, row.contact_key, row.values_json, row.delivery_status, row.source_url, row.created_month, row.created_at, row.updated_at],
    };
  }
  if (kind === 'event') {
    return {
      sql: `INSERT OR IGNORE INTO events (id, project_id, page_id, page_slug, event_type, visitor_id, session_id, dedupe_key, payload_json, created_month, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [row.id, row.project_id, row.page_id, row.page_slug, row.event_type, row.visitor_id, row.session_id, row.dedupe_key, row.payload_json, row.created_month, row.created_at],
    };
  }
  if (kind === 'delivery_log') {
    return {
      sql: `INSERT OR IGNORE INTO delivery_logs (id, project_id, lead_id, provider, target, status, retryable, attempts, idempotency_key, error, next_retry_at, created_month, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [row.id, row.project_id, row.lead_id, row.provider, row.target, row.status, row.retryable, row.attempts, row.idempotency_key, row.error, row.next_retry_at, row.created_month, row.created_at, row.updated_at],
    };
  }
  throw new Error(`unsupported backfill kind: ${kind}`);
}

function addRecord(records, kind, row, rollbackKey) {
  records.push({ kind, id: row.id, rollbackKey, query: makeSql(kind, row) });
}

function buildPlan(projects) {
  const now = new Date().toISOString();
  const records = [];
  const invalid = { leadLines: 0, eventLines: 0 };
  for (const source of projects) {
    invalid.leadLines += source.leads.invalid;
    invalid.eventLines += source.events.invalid;
    if (!source.pages.length && !source.leads.rows.length && !source.events.rows.length) continue;
    const firstPage = source.pages[0] || {};
    const project = projectShell(source.projectId, firstPage);
    addRecord(records, 'account', { id: project.owner_account_id, now }, `accounts:${project.owner_account_id}`);
    addRecord(records, 'project', project, `projects:${project.id}`);

    const pageRows = new Map();
    for (const page of source.pages) {
      const slug = safeId(page.slug || page.id || source.projectId, source.projectId);
      const row = encodeD1Page({ ...page, slug, projectId: source.projectId }, { projectId: source.projectId, slug });
      pageRows.set(slug, row);
      addRecord(records, 'page', row, `pages:${row.id}`);
    }

    for (const lead of source.leads.rows) {
      const pageSlug = safeId(lead.pageSlug || lead.page?.slug || firstPage.slug || source.projectId, source.projectId);
      const row = encodeD1Lead(lead, { projectId: source.projectId, pageId: pageRows.get(pageSlug)?.id || null, pageSlug });
      addRecord(records, 'lead', row, `leads:${row.id}`);
      for (const log of Array.isArray(lead.delivery?.logs) ? lead.delivery.logs : []) {
        const logRow = encodeD1DeliveryLog(log, { projectId: source.projectId, leadId: row.id, deliveryStatus: lead.delivery?.status || lead.deliveryStatus || '' });
        addRecord(records, 'delivery_log', logRow, `delivery_logs:${logRow.id}`);
      }
    }

    for (const event of source.events.rows) {
      const pageSlug = safeId(event.pageSlug || event.page?.slug || firstPage.slug || source.projectId, source.projectId);
      const row = encodeD1Event(event, { projectId: source.projectId, pageId: pageRows.get(pageSlug)?.id || null, pageSlug });
      if (!row.event_type) continue;
      addRecord(records, 'event', row, `events:${row.id}`);
    }
  }
  return {
    records: records.slice(0, maxRows),
    truncated: records.length > maxRows,
    totalPlannedRows: records.length,
    invalid,
  };
}

function groupCounts(records) {
  return records.reduce((acc, record) => {
    acc[record.kind] = (acc[record.kind] || 0) + 1;
    return acc;
  }, {});
}

async function wranglerDatabaseId() {
  const explicit = String(process.env.INLET_D1_DATABASE_ID || '').trim();
  if (explicit) return explicit;
  const raw = await readFile(path.join(rootDir, 'wrangler.jsonc'), 'utf8').catch(() => '');
  const match = raw.match(/"database_id"\s*:\s*"([^"]+)"/);
  return match ? match[1] : '';
}

async function d1Query(sql, params = []) {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const databaseId = await wranglerDatabaseId();
  if (!accountId || !token || !databaseId) throw new Error('CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and INLET_D1_DATABASE_ID or wrangler database_id are required for write mode.');
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(`Cloudflare D1 query failed: ${res.status} ${JSON.stringify(data.errors || data)}`);
  return data.result || [];
}

async function preflightExistingIds(records) {
  const byKind = new Map();
  for (const record of records) {
    if (!['projects', 'accounts', 'pages', 'leads', 'events', 'delivery_logs'].includes(`${record.kind}s`)) continue;
    const table = record.kind === 'delivery_log' ? 'delivery_logs' : `${record.kind}s`;
    if (!byKind.has(table)) byKind.set(table, []);
    byKind.get(table).push(record.id);
  }
  const existing = [];
  for (const [table, ids] of byKind.entries()) {
    for (let index = 0; index < ids.length; index += 50) {
      const chunk = ids.slice(index, index + 50);
      const placeholders = chunk.map(() => '?').join(',');
      const result = await d1Query(`SELECT id FROM ${table} WHERE id IN (${placeholders})`, chunk);
      for (const row of result[0]?.results || []) existing.push({ table, id: row.id });
    }
  }
  return existing;
}

async function executeWrite(records) {
  if (approval !== 'I_APPROVE_D1_BACKFILL_WRITE') throw new Error('Write mode requires INLET_D1_BACKFILL_APPROVAL=I_APPROVE_D1_BACKFILL_WRITE.');
  if (rollbackAck !== 'I_HAVE_D1_BACKUP_OR_EXPORT') throw new Error('Write mode requires INLET_D1_BACKFILL_ROLLBACK_ACK=I_HAVE_D1_BACKUP_OR_EXPORT.');
  const existing = await preflightExistingIds(records);
  if (existing.length && !allowExistingIds) {
    return { ok: false, blocked: true, reason: 'pre-existing ids found', existing: existing.slice(0, 50), existingCount: existing.length };
  }
  let executed = 0;
  for (let index = 0; index < records.length; index += batchSize) {
    const chunk = records.slice(index, index + batchSize);
    for (const record of chunk) {
      await d1Query(record.query.sql, record.query.params);
      executed += 1;
    }
  }
  return { ok: true, executed, existingIdsAllowed: allowExistingIds };
}

const projects = await loadProjects();
const plan = buildPlan(projects);
const rollbackTables = ['delivery_logs', 'events', 'leads', 'pages', 'projects', 'accounts'];
const rollback = {
  tag: importTag,
  warning: 'Rollback must only be used after confirming these ids were created by this backfill run. Pre-existing id conflicts block write mode by default.',
  order: rollbackTables,
  importedIds: plan.records.map((record) => record.rollbackKey),
};

let writeResult = null;
if (writeEnabled) writeResult = await executeWrite(plan.records);

const result = {
  ok: writeResult ? writeResult.ok : true,
  mode: writeEnabled ? 'write' : 'plan-only',
  writeGuard: {
    writeRequires: 'INLET_D1_BACKFILL_WRITE=1',
    approvalRequires: 'INLET_D1_BACKFILL_APPROVAL=I_APPROVE_D1_BACKFILL_WRITE',
    rollbackRequires: 'INLET_D1_BACKFILL_ROLLBACK_ACK=I_HAVE_D1_BACKUP_OR_EXPORT',
    existingIdsDefault: 'blocked',
  },
  dataDir,
  importTag,
  batchSize,
  maxRows,
  truncated: plan.truncated,
  sourceProjects: projects.length,
  counts: groupCounts(plan.records),
  invalidInputLines: plan.invalid,
  totalPlannedRows: plan.totalPlannedRows,
  plannedRowsAfterLimit: plan.records.length,
  sample: plan.records.slice(0, 5).map((record) => ({ kind: record.kind, id: record.id, params: record.query.params.length })),
  rollback,
  writeResult,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
