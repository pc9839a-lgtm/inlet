import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { parseExcludedSourceTypes } from '../functions/api/calltag/v1/_delivery.js';

const excluded = parseExcludedSourceTypes(new URL(
  'https://calltag.pagero.kr/api/calltag/v1/leads?excludeSourceType=pagero&excludeSourceType=legacy,custom'
));
assert.deepEqual(excluded, ['pagero', 'legacy', 'custom']);

const files = {
  delivery: 'functions/api/calltag/v1/_delivery.js',
  leads: 'functions/api/calltag/v1/leads.js',
  hook: 'functions/api/calltag/v1/hooks/[endpointKey].js',
  push: 'functions/api/call/push/_shared.js',
};
const source = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, file]) => [key, await readFile(file, 'utf8')]),
));

for (const token of [
  'listUniversalLeadsForDelivery',
  "lower(source_type) NOT IN",
  "status IN ('ACCEPTED', 'DELIVERED')",
  "SET status = 'DELIVERED'",
  "getAll('excludeSourceType')",
]) {
  assert.ok(source.delivery.includes(token), `delivery contract missing: ${token}`);
}
assert.ok(source.leads.includes('parseExcludedSourceTypes(url)'), 'GET must pass source exclusions to delivery query');
assert.ok(source.leads.includes('notifyUniversalLeadAvailable'), 'Direct REST intake must trigger generic FCM');
assert.ok(source.leads.includes('if (result.created)'), 'duplicate direct API events must not trigger FCM');
assert.ok(source.leads.includes('FCM failure must never roll back'), 'push must stay non-transactional to lead acceptance');

for (const token of [
  "type: 'pagero_lead_available'",
  "type: 'lead_available'",
  "'pagero_lead_available'",
  "'lead_available'",
  "restricted_package_name: 'kr.pagero.calltag'",
  "priority: 'HIGH'",
  "ttl: '300s'",
]) {
  assert.ok(source.push.includes(token), `push contract missing: ${token}`);
}
const genericBlock = source.push.slice(
  source.push.indexOf('export async function notifyUniversalLeadAvailable'),
  source.push.indexOf('async function notifyOwnerDevices'),
);
assert.ok(genericBlock.includes("type: 'lead_available'"));
for (const piiToken of ['customerName', 'customerPhone', 'phone:', 'email:', 'inquiryContent']) {
  assert.ok(!genericBlock.includes(piiToken), `generic FCM must not contain PII token: ${piiToken}`);
}

assert.ok(source.hook.includes('sha256(endpointKey)'), 'webhook push owner must be resolved from hashed endpoint');
assert.ok(source.hook.includes('SELECT owner_id'), 'webhook push must resolve owner server-side');
assert.ok(source.hook.includes("result?.result !== 'DUPLICATE_IGNORED'"), 'duplicate webhook must not trigger FCM');
assert.ok(source.hook.includes('notifyUniversalLeadAvailable'), 'mapped webhook must trigger generic FCM');
assert.ok(!source.hook.includes('body.ownerId'), 'webhook route must never trust body ownerId');

for (const file of Object.values(files)) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(checked.status, 0, `syntax check failed for ${file}: ${checked.stderr || checked.stdout}`);
}

console.log(JSON.stringify({
  ok: true,
  phase: 'CallTag Android Realtime Lead Delivery Phase 3 server contract',
  contracts: [
    'generic-pii-free-fcm-signal',
    'direct-api-realtime-trigger',
    'generic-webhook-realtime-trigger',
    'duplicate-push-suppression',
    'server-resolved-webhook-owner',
    'pagero-canonical-delivery-exclusion',
    'legacy-pagero-push-preserved',
  ],
}, null, 2));
