import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const schema = await readFile('migrations/0001_inlet_core.sql', 'utf8');
const leadDedupeMigration = await readFile('migrations/0002_lead_dedupe_fields.sql', 'utf8');
const eventDimensionsMigration = await readFile('migrations/0003_event_dimensions.sql', 'utf8');
const blockedLeadMigration = await readFile('migrations/0004_lead_blocked_submissions.sql', 'utf8');
const authEmailMigration = await readFile('migrations/0005_auth_email_verifications.sql', 'utf8');
const pageDomainMigration = await readFile('migrations/0007_page_domains.sql', 'utf8');
const pageDomainOperationsMigration = await readFile('migrations/0008_page_domain_operations.sql', 'utf8');
const adapter = await readFile('server/storage/d1Adapter.mjs', 'utf8');
const runtimeAdapter = await readFile('server/storage/runtimeAdapter.mjs', 'utf8');
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
  'lead_blocked_submissions',
  'delivery_logs',
  'ai_drafts',
  'ai_keys',
  'subscriptions',
  'payments',
  'ownership_transfer_requests',
  'audit_logs',
];

for (const table of requiredTables) {
  const tableSchema = table === 'lead_blocked_submissions' ? blockedLeadMigration : schema;
  assert(tableSchema.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `missing D1 table: ${table}`);
  assert(adapter.includes(`'${table}'`), `D1 adapter table list missing: ${table}`);
}

for (const token of [
  'UNIQUE(project_id, account_id)',
  'UNIQUE(project_id, slug)',
  'idx_leads_project_month',
  'idx_leads_contact_dedupe',
  'idx_events_project_month_type',
  'idx_delivery_logs_retry',
  'idx_ai_keys_owner_project',
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
  'upsertD1Project',
  'replaceD1ProjectMembers',
  'listD1Leads',
  'insertD1BlockedLeadSubmission',
  'listD1BlockedSubmissions',
  'listD1Events',
  'encodeD1Lead',
  'decodeD1Lead',
  'upsertD1Lead',
  'findD1LeadsByIntakeSignals',
  'encodeD1Event',
  'decodeD1Event',
  'insertD1Event',
  'insertD1AuditLog',
  'fallbackAdapter',
]) {
  const accepted = token === 'listD1BlockedSubmissions'
    ? adapter.includes('listD1BlockedLeadSubmissions')
    : adapter.includes(token);
  assert(accepted, `D1 adapter missing contract token: ${token}`);
}

assert(adapter.includes('ON CONFLICT(id) DO UPDATE SET'), 'D1 lead upsert should be idempotent');
assert(adapter.includes('currentBySlug') && adapter.includes('currentByIdSameProject'), 'D1 page upsert should pre-resolve page id and project slug collisions before insert');
assert(adapter.includes('INSERT OR IGNORE INTO events'), 'D1 event insert should dedupe repeated event ids');
assert(adapter.includes('created_month'), 'D1 adapter should preserve month index field');
assert(adapter.includes('contact_key'), 'D1 adapter should preserve lead dedupe key');

for (const token of [
  'ALTER TABLE leads ADD COLUMN client_id',
  'ALTER TABLE leads ADD COLUMN ip_hash',
  'ALTER TABLE leads ADD COLUMN user_agent_hash',
  'ALTER TABLE leads ADD COLUMN phone_normalized',
  'ALTER TABLE leads ADD COLUMN email_normalized',
  'ALTER TABLE leads ADD COLUMN duplicate',
  'ALTER TABLE leads ADD COLUMN duplicate_reason',
  'ALTER TABLE leads ADD COLUMN risk_score',
  'ALTER TABLE leads ADD COLUMN submitted_at',
  'idx_leads_phone_30d',
  'idx_leads_email_30d',
  'idx_leads_client_repeat',
  'idx_leads_ip_short_window',
  'idx_leads_duplicate',
]) {
  assert(leadDedupeMigration.includes(token), `D1 lead dedupe migration missing token: ${token}`);
}

for (const token of [
  'ALTER TABLE events ADD COLUMN channel',
  'ALTER TABLE events ADD COLUMN device',
  'idx_events_project_month_channel',
  'idx_events_project_month_device',
]) {
  assert(eventDimensionsMigration.includes(token), `D1 event dimensions migration missing token: ${token}`);
}

for (const token of [
  'CREATE TABLE IF NOT EXISTS lead_blocked_submissions',
  'policy_snapshot_json',
  'idx_blocked_leads_project_month',
  'idx_blocked_leads_project_page',
  'idx_blocked_leads_reason',
]) {
  assert(blockedLeadMigration.includes(token), `D1 blocked lead migration missing token: ${token}`);
}

for (const token of [
  'CREATE TABLE IF NOT EXISTS auth_email_verifications',
  'code_hash',
  "status TEXT NOT NULL DEFAULT 'pending'",
  'attempts INTEGER NOT NULL DEFAULT 0',
  'idx_auth_email_verifications_lookup',
  'idx_auth_email_verifications_purpose',
]) {
  assert(authEmailMigration.includes(token), `D1 auth email migration missing token: ${token}`);
}

for (const token of [
  'CREATE TABLE IF NOT EXISTS page_domains',
  'UNIQUE(page_id)',
  'idx_page_domains_hostname_owner',
  "status <> 'disconnected'",
  'idx_page_domains_project_status',
  'idx_page_domains_status_checked',
  "ssl_status TEXT NOT NULL DEFAULT 'pending'",
  "status IN ('ready', 'pending', 'verifying', 'active', 'failed', 'disconnected')",
]) {
  assert(pageDomainMigration.includes(token), `D1 page domain migration missing token: ${token}`);
}

for (const token of [
  'ALTER TABLE page_domains ADD COLUMN retry_count',
  'ALTER TABLE page_domains ADD COLUMN next_retry_at',
  'ALTER TABLE page_domains ADD COLUMN last_error_code',
  'ALTER TABLE page_domains ADD COLUMN escalated_at',
  'ALTER TABLE page_domains ADD COLUMN last_attempt_at',
  'idx_page_domains_retry_due',
  'idx_page_domains_escalated',
  'trg_page_domains_reset_ops_on_reconnect',
]) {
  assert(pageDomainOperationsMigration.includes(token), `D1 page domain operations migration missing token: ${token}`);
}

for (const token of [
  'isD1MissingLeadDedupeColumnError',
  'isD1MissingEventDimensionColumnError',
  'upsertD1LeadLegacy',
  'insertD1EventLegacy',
  'findD1LeadsByIntakeSignals',
  'phone_normalized',
  'email_normalized',
  'duplicate_reason',
  'channelData',
  'deviceData',
]) {
  assert(adapter.includes(token), `D1 lead dedupe adapter missing contract token: ${token}`);
}

for (const token of [
  'normalizeStorageMode',
  'detectD1Binding',
  'createStorageRuntime',
  'storageRuntimeHealth',
  'storageRuntimePlan',
  'INLET_STORAGE_ADAPTER',
  'INLET_STORAGE_MODE',
  'd1UnavailablePlan',
]) {
  assert(runtimeAdapter.includes(token), `D1 runtime adapter missing contract token: ${token}`);
}

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
  tables: requiredTables.length + 1,
  binding: 'DB',
  database: 'inlet-prod',
  migration: '0001_inlet_core.sql',
  leadDedupeMigration: '0002_lead_dedupe_fields.sql',
  eventDimensionsMigration: '0003_event_dimensions.sql',
  blockedLeadMigration: '0004_lead_blocked_submissions.sql',
  authEmailMigration: '0005_auth_email_verifications.sql',
  pageDomainMigration: '0007_page_domains.sql',
  pageDomainOperationsMigration: '0008_page_domain_operations.sql',
  adapter: 'server/storage/d1Adapter.mjs',
  runtimeAdapter: 'server/storage/runtimeAdapter.mjs',
}, null, 2));
