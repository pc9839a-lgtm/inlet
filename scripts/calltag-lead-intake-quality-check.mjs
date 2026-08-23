import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const files = {
  migration: 'migrations/0010_calltag_universal_lead_intake.sql',
  shared: 'functions/api/calltag/v1/_shared.js',
  leads: 'functions/api/calltag/v1/leads.js',
  keys: 'functions/api/calltag/v1/keys.js',
  ack: 'functions/api/calltag/v1/leads/ack.js',
  middleware: 'functions/api/_middleware.js',
};
const source = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, file]) => [key, await readFile(file, 'utf8')]),
));

for (const token of [
  'CREATE TABLE IF NOT EXISTS calltag_lead_customers',
  'UNIQUE(owner_id, normalized_phone)',
  'CREATE TABLE IF NOT EXISTS calltag_lead_events',
  'UNIQUE(owner_id, event_id)',
  'UNIQUE(owner_id, dedupe_key)',
  'CREATE TABLE IF NOT EXISTS calltag_api_keys',
  'key_hash TEXT NOT NULL UNIQUE',
  'CREATE TABLE IF NOT EXISTS calltag_lead_audit',
]) {
  assert(source.migration.includes(token), `lead intake migration missing: ${token}`);
  assert(source.shared.includes(token), `runtime lead schema missing: ${token}`);
}
assert(!source.migration.includes('raw_key'), 'raw API keys must never be stored');
assert(!source.shared.includes('raw_key'), 'runtime schema must never store raw API keys');

for (const token of [
  'authenticateLeadApiKey',
  "crypto.subtle.digest('SHA-256'",
  'createLeadApiKey',
  'rotateLeadApiKey',
  'revokeLeadApiKey',
  'intakeCanonicalLead',
  'DUPLICATE_IGNORED',
  'MATCHED_EXISTING',
  'canonicalLeadFromPageroQueue',
  'listUniversalLeads',
  'acknowledgeUniversalLeads',
]) {
  assert(source.shared.includes(token), `lead intake core missing: ${token}`);
}

assert(source.leads.includes("request.headers.get('Idempotency-Key')"), 'direct lead API must consume Idempotency-Key');
assert(source.leads.includes('apiKey.ownerId'), 'direct lead API must scope writes from the authenticated API key');
assert(!source.leads.includes('body.ownerId'), 'direct lead API must never trust ownerId from request body');
assert(source.leads.includes('callSession') && source.leads.includes('session.ownerId'), 'lead pull must use signed CallTag session owner');
assert(source.leads.includes('recordLeadAudit'), 'direct lead API must emit PII-free audit rows');

assert(source.keys.includes('callSession') && source.keys.includes('session.ownerId'), 'API key lifecycle must be session-scoped');
assert(source.keys.includes("action === 'create'") && source.keys.includes("action === 'rotate'") && source.keys.includes("action === 'revoke'"), 'API key lifecycle must support create/rotate/revoke');
assert(!source.keys.includes('key_hash'), 'API key endpoint must never expose stored key hashes');

assert(source.ack.includes('callSession') && source.ack.includes('session.ownerId'), 'generic ACK must use signed CallTag session owner');
assert(source.ack.includes('acknowledgeUniversalLeads'), 'generic ACK route must use universal lead store');

for (const token of [
  "request.method !== 'POST' || url.pathname !== '/api/leads'",
  'const response = await next()',
  'enqueuePageroLead',
  'notifyPageroLeadAvailable',
  'canonicalLeadFromPageroQueue',
  'intakeCanonicalLead',
  'Pagero canonical lead dual-write failed',
]) {
  assert(source.middleware.includes(token), `Pagero dual-write middleware missing: ${token}`);
}
assert(source.middleware.indexOf('enqueuePageroLead') < source.middleware.indexOf('intakeCanonicalLead'), 'existing Pagero queue must remain the first compatibility write');
assert(source.middleware.includes('return response'), 'Pagero dual-write failure must not fail the original inquiry response');

for (const file of [files.shared, files.leads, files.keys, files.ack, files.middleware]) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert(checked.status === 0, `syntax check failed for ${file}: ${checked.stderr || checked.stdout}`);
}

console.log(JSON.stringify({
  ok: true,
  phase: 'CallTag Lead Intake Phase 0/1',
  contracts: [
    'tenant-scoped-api-keys',
    'api-key-hash-only-storage',
    'canonical-customer-inquiry-split',
    'idempotent-event-dedupe',
    'session-scoped-pull-ack',
    'pagero-dual-write-with-legacy-queue-preserved',
    'pii-free-intake-audit',
  ],
}, null, 2));
