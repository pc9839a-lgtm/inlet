import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const schema = await readFile('migrations/0001_inlet_core.sql', 'utf8');
const adapter = await readFile('server/storage/d1Adapter.mjs', 'utf8');
const wrangler = await readFile('wrangler.jsonc', 'utf8');

const requiredTables = [
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

for (const table of requiredTables) {
  assert(schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `missing D1 table: ${table}`);
  assert(adapter.includes(`'${table}'`), `D1 adapter table list missing: ${table}`);
}

for (const token of [
  'UNIQUE(project_id, account_id)',
  'UNIQUE(project_id, slug)',
  'idx_leads_project_month',
  'idx_leads_contact_dedupe',
  'idx_events_project_month_type',
  'idx_delivery_logs_retry',
  'idx_subscriptions_status',
  'idx_transfer_project_status',
  'idx_audit_project_created',
  "billing_status TEXT NOT NULL DEFAULT 'trial'",
  "status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'canceled', 'refunded'))",
  "billing_clearance_status TEXT NOT NULL DEFAULT 'not_checked'",
]) {
  assert(schema.includes(token), `D1 schema missing contract token: ${token}`);
}

for (const token of [
  'D1_INDEX_PRIORITIES',
  'd1UnavailablePlan',
  'assertD1Binding',
  'queryD1Rows',
  'countD1Rows',
  'getD1ProjectBySlug',
  'listD1Leads',
  'listD1Events',
  'encodeD1Lead',
  'decodeD1Lead',
  'upsertD1Lead',
  'encodeD1Event',
  'decodeD1Event',
  'insertD1Event',
  'insertD1AuditLog',
  'fallbackAdapter',
]) {
  assert(adapter.includes(token), `D1 adapter missing contract token: ${token}`);
}

assert(adapter.includes('ON CONFLICT(id) DO UPDATE SET'), 'D1 lead upsert should be idempotent');
assert(adapter.includes('INSERT OR IGNORE INTO events'), 'D1 event insert should dedupe repeated event ids');
assert(adapter.includes('created_month'), 'D1 adapter should preserve month index field');
assert(adapter.includes('contact_key'), 'D1 adapter should preserve lead dedupe key');

assert(wrangler.includes('"name": "inlet"'), 'wrangler config should keep project name');
assert(wrangler.includes('"pages_build_output_dir": "dist"'), 'wrangler config should keep Pages output dir');
assert(wrangler.includes('"d1_databases"'), 'wrangler config should include D1 bindings');
assert(wrangler.includes('"binding": "DB"'), 'wrangler config should expose the DB binding');
assert(wrangler.includes('"database_name": "inlet-prod"'), 'wrangler config should reference inlet-prod D1');
assert(
  wrangler.includes('"database_id": "b68d3820-001f-4dbe-87cd-dc9fc0be17ee"'),
  'wrangler config should reference the created inlet-prod D1 database id',
);

console.log(JSON.stringify({
  ok: true,
  tables: requiredTables.length,
  binding: 'DB',
  database: 'inlet-prod',
  migration: '0001_inlet_core.sql',
  adapter: 'server/storage/d1Adapter.mjs',
}, null, 2));
