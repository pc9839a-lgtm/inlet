import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import {
  hasPageRoDataRetentionSecret,
  pageRoDataRetentionPolicy,
  runPageRoDataRetention,
} from '../functions/api/admin/data/retention.js';
import {
  evaluateDataRetentionGate,
  normalizeDataRetentionAllowedOrigins,
  normalizeDataRetentionEndpoint,
} from './pagero-data-retention-safe-runner.mjs';

function createD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE leads (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE delivery_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE ai_drafts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return {
    sqlite,
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let params = [];
      const wrapper = {
        bind(...values) {
          params = values;
          return wrapper;
        },
        async first() {
          return statement.get(...params) || null;
        },
        async all() {
          return { results: statement.all(...params), meta: {} };
        },
        async run() {
          const result = statement.run(...params);
          return { changes: Number(result.changes || 0), meta: { changes: Number(result.changes || 0) } };
        },
      };
      return wrapper;
    },
  };
}

function addRow(db, table, id, createdAt, extra = {}) {
  if (table === 'delivery_logs') {
    db.sqlite.prepare('INSERT INTO delivery_logs (id, project_id, lead_id, created_at) VALUES (?, ?, ?, ?)')
      .run(id, 'project-1', extra.leadId, createdAt);
    return;
  }
  db.sqlite.prepare(`INSERT INTO ${table} (id, project_id, created_at) VALUES (?, ?, ?)`)
    .run(id, 'project-1', createdAt);
}

const defaults = pageRoDataRetentionPolicy({});
assert.equal(defaults.leadDays, 180);
assert.equal(defaults.deliveryLogDays, 30);
assert.equal(defaults.aiDraftDays, 30);
assert.equal(defaults.eventDays, 180);
assert.equal(defaults.batchLimit, 500);
assert.equal(defaults.eventRetentionClass, 'conservative-potential-pii');

const guarded = pageRoDataRetentionPolicy({
  INLET_EVENT_RETENTION_DAYS: '395',
  INLET_DATA_RETENTION_BATCH_LIMIT: '99999',
});
assert.equal(guarded.eventDays, 180, 'raw event retention must not exceed the PII-conservative cap');
assert.equal(guarded.batchLimit, 5000, 'one retention execution must remain bounded');

const secretRequest = new Request('https://pagero.kr/api/admin/data/retention', {
  headers: { 'X-Inlet-Data-Retention-Secret': 'a'.repeat(24) },
});
assert(hasPageRoDataRetentionSecret(secretRequest, { INLET_DATA_RETENTION_SECRET: 'a'.repeat(24) }));
assert(!hasPageRoDataRetentionSecret(secretRequest, { INLET_DATA_RETENTION_SECRET: 'different-secret-value-1234' }));

const allowed = normalizeDataRetentionAllowedOrigins('https://preview.example.com');
assert(allowed.includes('https://pagero.kr') && allowed.includes('https://preview.example.com'));
assert.equal(normalizeDataRetentionEndpoint().pathname, '/api/admin/data/retention');
assert.throws(() => normalizeDataRetentionEndpoint('http://pagero.kr/api/admin/data/retention'), /HTTPS/);
assert.throws(() => normalizeDataRetentionEndpoint('https://pagero.kr/api/admin/audit/retention'), /exact path/);

const dryGate = evaluateDataRetentionGate({
  secret: 'x'.repeat(24),
  allowedOrigins: ['https://pagero.kr'],
});
assert(dryGate.ok && dryGate.dryRun, 'runner must default to dry-run');

const blockedWriteGate = evaluateDataRetentionGate({
  secret: 'x'.repeat(24),
  allowedOrigins: ['https://pagero.kr'],
  writeEnabled: true,
});
assert(!blockedWriteGate.ok && blockedWriteGate.errors.some((item) => item.includes('approval phrase')));

const writeGate = evaluateDataRetentionGate({
  secret: 'x'.repeat(24),
  allowedOrigins: ['https://pagero.kr'],
  writeEnabled: true,
  approval: 'I_APPROVE_PAGERO_DATA_RETENTION',
});
assert(writeGate.ok && !writeGate.dryRun, 'writes require both enable flag and exact approval');

const db = createD1();
addRow(db, 'leads', 'lead-old', '2026-03-01T00:00:00.000Z');
addRow(db, 'leads', 'lead-fresh', '2026-09-20T00:00:00.000Z');
addRow(db, 'delivery_logs', 'delivery-old', '2026-08-01T00:00:00.000Z', { leadId: 'lead-old' });
addRow(db, 'delivery_logs', 'delivery-fresh-old-lead', '2026-09-20T00:00:00.000Z', { leadId: 'lead-old' });
addRow(db, 'delivery_logs', 'delivery-fresh', '2026-09-20T00:00:00.000Z', { leadId: 'lead-fresh' });
addRow(db, 'events', 'event-old', '2026-03-01T00:00:00.000Z');
addRow(db, 'events', 'event-fresh', '2026-09-20T00:00:00.000Z');
addRow(db, 'ai_drafts', 'draft-old', '2026-08-01T00:00:00.000Z');
addRow(db, 'ai_drafts', 'draft-fresh', '2026-09-20T00:00:00.000Z');

const now = new Date('2026-10-05T00:00:00.000Z');
const env = {
  INLET_LEAD_RETENTION_DAYS: '180',
  INLET_DELIVERY_LOG_RETENTION_DAYS: '30',
  INLET_AI_DRAFT_RETENTION_DAYS: '30',
  INLET_EVENT_RETENTION_DAYS: '180',
  INLET_DATA_RETENTION_BATCH_LIMIT: '10',
};

const dryRun = await runPageRoDataRetention(db, env, { dryRun: true, now });
assert.equal(dryRun.targets.leads.candidates, 1);
assert.equal(dryRun.targets.deliveryLogs.candidates, 1);
assert.equal(dryRun.targets.events.candidates, 1);
assert.equal(dryRun.targets.aiDrafts.candidates, 1);
assert.equal(dryRun.totalDeleted, 0);
assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM leads').get().count, 2);

const executed = await runPageRoDataRetention(db, env, { dryRun: false, now });
assert.equal(executed.targets.leads.deleted, 1);
assert.equal(executed.targets.deliveryLogs.deleted, 1);
assert.equal(executed.targets.events.deleted, 1);
assert.equal(executed.targets.aiDrafts.deleted, 1);
assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM leads').get().count, 1);
assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM events').get().count, 1);
assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM ai_drafts').get().count, 1);
assert.equal(
  db.sqlite.prepare('SELECT COUNT(*) AS count FROM delivery_logs').get().count,
  1,
  'lead deletion must cascade its remaining delivery retry state',
);
assert.equal(db.sqlite.prepare("SELECT id FROM leads LIMIT 1").get().id, 'lead-fresh');
assert.equal(db.sqlite.prepare("SELECT id FROM delivery_logs LIMIT 1").get().id, 'delivery-fresh');
db.sqlite.close();

const endpointSource = await readFile('functions/api/admin/data/retention.js', 'utf8');
const runnerSource = await readFile('scripts/pagero-data-retention-safe-runner.mjs', 'utf8');
const auditSource = await readFile('functions/api/admin/audit/retention.js', 'utf8');
const policySource = await readFile('docs/ops-pii-retention-export-policy.md', 'utf8');

assert(endpointSource.includes('DELETE FROM ${table}') && endpointSource.includes('ORDER BY created_at ASC, id ASC'), 'retention deletes must be oldest-first and bounded');
assert(endpointSource.includes("eventRetentionClass: 'conservative-potential-pii'"), 'raw event PII guard must remain explicit');
assert(runnerSource.includes("PAGERO_DATA_RETENTION_WRITE") && runnerSource.includes("I_APPROVE_PAGERO_DATA_RETENTION"), 'live deletion runner must remain fail-closed');
assert(runnerSource.includes("redirect: 'error'"), 'retention runner must not forward secrets through redirects');
assert(auditSource.includes("INLET_AUDIT_RETENTION_DAYS") && auditSource.includes("audit.retention_completed"), 'existing audit retention must remain operational');
assert(policySource.includes('현재 PageRo event') || policySource.includes('Current PageRo event'), 'privacy policy must document conservative event retention');

console.log(JSON.stringify({
  ok: true,
  checks: 34,
  defaults,
  dryRunCandidates: dryRun.totalCandidates,
  executedDeletes: executed.totalDeleted,
  auditRetentionPreserved: true,
  productionWriteExecuted: false,
}, null, 2));
