import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { canonicalDedupeKey, normalizeCanonicalLead, normalizePhone } from '../functions/api/calltag/v1/_utils.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const files = {
  migration: 'migrations/0010_calltag_universal_lead_intake.sql',
  barrel: 'functions/api/calltag/v1/_shared.js',
  schema: 'functions/api/calltag/v1/_schema.js',
  keysCore: 'functions/api/calltag/v1/_keys.js',
  store: 'functions/api/calltag/v1/_store.js',
  utils: 'functions/api/calltag/v1/_utils.js',
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
  'UNIQUE(owner_id, connection_id, event_id)',
  'UNIQUE(owner_id, dedupe_key)',
  'CREATE TABLE IF NOT EXISTS calltag_api_keys',
  'connection_id TEXT NOT NULL',
  'key_hash TEXT NOT NULL UNIQUE',
  'CREATE TABLE IF NOT EXISTS calltag_lead_audit',
]) {
  assert(source.migration.includes(token), `lead intake migration missing: ${token}`);
  assert(source.schema.includes(token), `runtime lead schema missing: ${token}`);
}
assert(!source.migration.includes('raw_key'), 'raw API keys must never be stored');
assert(!source.schema.includes('raw_key'), 'runtime schema must never store raw API keys');
assert(!source.keysCore.includes('raw_key'), 'API key core must never persist a raw_key column');

for (const token of [
  'authenticateLeadApiKey',
  'createLeadApiKey',
  'rotateLeadApiKey',
  'revokeLeadApiKey',
  'connectionId: existing.connection_id',
]) {
  assert(source.keysCore.includes(token), `lead API key core missing: ${token}`);
}
assert(source.utils.includes("crypto.subtle.digest('SHA-256'"), 'API keys/dedupe hashing must use SHA-256 Web Crypto');

for (const token of [
  'intakeCanonicalLead',
  'DUPLICATE_IGNORED',
  'MATCHED_EXISTING',
  'canonicalLeadFromPageroQueue',
  'listUniversalLeads',
  'acknowledgeUniversalLeads',
  'limitedJson(lead.source',
]) {
  assert(source.store.includes(token), `lead intake store missing: ${token}`);
}
assert(source.barrel.includes("export * from './_keys.js'") && source.barrel.includes("export * from './_store.js'"), 'lead intake barrel must export modular core');

assert(source.leads.includes("request.headers.get('Idempotency-Key')"), 'direct lead API must consume Idempotency-Key');
assert(source.leads.includes('CALLTAG_LEAD_IDEMPOTENCY_REQUIRED'), 'direct lead API must require a stable idempotency primitive');
assert(source.leads.includes('apiKey.ownerId'), 'direct lead API must scope writes from the authenticated API key');
assert(source.leads.includes('connectionId: apiKey.connectionId'), 'direct lead API must scope dedupe to a stable connection id');
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
  'ownerIdForProject(env.DB, projectId)',
  'canonicalLeadFromPageroQueue',
  'intakeCanonicalLead',
  'Pagero canonical lead dual-write failed',
]) {
  assert(source.middleware.includes(token), `Pagero dual-write middleware missing: ${token}`);
}
assert(!source.middleware.includes('submitted?.project?.ownerId'), 'Pagero canonical owner must never come from public form payload');
assert(!source.middleware.includes('savedLead.ownerId'), 'Pagero canonical owner must never trust lead payload owner fields');
assert(source.middleware.indexOf('enqueuePageroLead') < source.middleware.lastIndexOf('intakeCanonicalLead'), 'existing Pagero queue must remain the first compatibility write');
assert(source.middleware.includes('return response'), 'Pagero dual-write failure must not fail the original inquiry response');

assert(normalizePhone('+82 10-1234-5678') === '01012345678', 'Korean +82 phone normalization must match domestic 010 format');
const normalized = normalizeCanonicalLead({ customer: { phone: '+82 10-1234-5678' }, source: { type: 'custom_api' } });
assert(normalized.customer.phone === '01012345678', 'canonical lead must use normalized phone for customer matching');
const dedupeA = await canonicalDedupeKey({ ...normalized, eventId: '', externalId: 'lead-1' }, '', 'ctconn_A');
const dedupeARepeat = await canonicalDedupeKey({ ...normalized, eventId: '', externalId: 'lead-1' }, '', 'ctconn_A');
const dedupeB = await canonicalDedupeKey({ ...normalized, eventId: '', externalId: 'lead-1' }, '', 'ctconn_B');
assert(dedupeA === dedupeARepeat, 'same connection/external id must produce stable dedupe key');
assert(dedupeA !== dedupeB, 'different connections must not collide on external ids');

for (const file of [
  files.barrel,
  files.schema,
  files.keysCore,
  files.store,
  files.utils,
  files.leads,
  files.keys,
  files.ack,
  files.middleware,
]) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert(checked.status === 0, `syntax check failed for ${file}: ${checked.stderr || checked.stdout}`);
}

console.log(JSON.stringify({
  ok: true,
  phase: 'CallTag Lead Intake Phase 0/1',
  contracts: [
    'tenant-scoped-api-keys',
    'api-key-hash-only-storage',
    'connection-stable-key-rotation',
    'canonical-customer-inquiry-split',
    'connection-scoped-idempotent-dedupe',
    'korean-phone-normalization',
    'session-scoped-pull-ack',
    'server-resolved-pagero-owner',
    'pagero-dual-write-with-legacy-queue-preserved',
    'pii-free-intake-audit',
  ],
}, null, 2));
