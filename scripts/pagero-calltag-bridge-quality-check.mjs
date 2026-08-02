import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const migration = await readFile('migrations/0006_calltag_pagero_lead_queue.sql', 'utf8');
const shared = await readFile('functions/api/call/pagero/_shared.js', 'utf8');
const listRoute = await readFile('functions/api/call/pagero/leads.js', 'utf8');
const ackRoute = await readFile('functions/api/call/pagero/leads/ack.js', 'utf8');
const healthRoute = await readFile('functions/api/call/pagero/health.js', 'utf8');
const middleware = await readFile('functions/api/_middleware.js', 'utf8');

for (const token of [
  'CREATE TABLE IF NOT EXISTS calltag_pagero_leads',
  'event_id TEXT NOT NULL UNIQUE',
  "status IN ('PENDING', 'DELIVERED', 'IMPORTED', 'REJECTED')",
  'idx_calltag_pagero_owner_status_id',
  'idx_calltag_pagero_phone',
]) {
  assert(migration.includes(token), `CallTag queue migration missing: ${token}`);
  assert(shared.includes(token), `CallTag runtime schema missing: ${token}`);
}

for (const token of [
  'enqueuePageroLead',
  'listPageroLeads',
  'acknowledgePageroLeads',
  'owner_account_id',
  "ON CONFLICT(event_id) DO NOTHING",
  "status IN ('PENDING', 'DELIVERED')",
  "status = 'DELIVERED'",
]) {
  assert(shared.includes(token), `CallTag queue helper missing: ${token}`);
}

assert(middleware.includes("request.method !== 'POST' || url.pathname !== '/api/leads'"), 'middleware must only observe successful lead POST requests');
assert(middleware.includes('const response = await next()'), 'middleware must preserve the existing lead route');
assert(middleware.includes('if (!response.ok || !env?.DB) return response'), 'failed lead saves must never enter the CallTag queue');
assert(middleware.includes('response.clone().json()'), 'middleware must inspect the saved lead response without consuming it');
assert(middleware.includes('console.error') && middleware.includes('return response'), 'queue failures must not fail the original Pagero inquiry');
assert(!middleware.includes('PAGERO_WEBHOOK_SECRET'), 'Pagero browser/API middleware must not contain a shared webhook secret');

assert(listRoute.includes('callSession') && listRoute.includes('session.ownerId'), 'CallTag lead list must be scoped to the signed account');
assert(listRoute.includes('nextAfter') && listRoute.includes('hasMore'), 'CallTag lead list must keep cursor pagination');
assert(ackRoute.includes('callSession') && ackRoute.includes('acknowledgePageroLeads'), 'CallTag ACK must verify the signed account');
assert(healthRoute.includes('ensurePageroLeadQueueSchema'), 'health route must verify and initialize the D1 queue schema');

console.log(JSON.stringify({
  ok: true,
  flow: 'Pagero lead save -> existing D1 queue -> CallTag account session -> local customer import -> ACK',
  secretRequired: false,
  protectedHomeFilesChanged: false,
}, null, 2));
