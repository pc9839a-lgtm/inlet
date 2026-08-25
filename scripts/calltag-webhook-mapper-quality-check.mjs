import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  applyWebhookMapping,
  flattenWebhookPayload,
  getJsonPointerValue,
  suggestWebhookMapping,
  validateWebhookMapping,
  webhookMappingReady,
} from '../functions/api/calltag/v1/_mapper.js';

const payload = {
  data: {
    customer: {
      full_name: '홍길동',
      mobile: '+82 10-1234-5678',
      email: 'hong@example.com',
    },
    message: '보험 상담을 요청합니다.',
    lead_id: 'lead-meta-001',
    created_time: '2026-08-23T20:00:00+09:00',
    answers: {
      product: '태아보험',
    },
  },
};

const suggestion = suggestWebhookMapping(payload);
assert.equal(suggestion.suggestions.phone.pointer, '/data/customer/mobile');
assert.equal(suggestion.suggestions.name.pointer, '/data/customer/full_name');
assert.equal(suggestion.suggestions.email.pointer, '/data/customer/email');
assert.equal(suggestion.suggestions.content.pointer, '/data/message');
assert.equal(suggestion.suggestions.externalId.pointer, '/data/lead_id');
assert.equal(suggestion.suggestions.submittedAt.pointer, '/data/created_time');
assert.equal(suggestion.draftMapping.phone, '/data/customer/mobile');

const mapping = validateWebhookMapping({
  name: '/data/customer/full_name',
  phone: '/data/customer/mobile',
  email: '/data/customer/email',
  content: '/data/message',
  externalId: '/data/lead_id',
  submittedAt: '/data/created_time',
  customFields: [
    { path: '/data/answers/product', key: 'product', label: '관심상품' },
  ],
});
assert.equal(webhookMappingReady(mapping), true);

const canonical = applyWebhookMapping(payload, mapping, {
  id: 'ctconn_qa',
  name: 'Meta 테스트',
  source_name: 'Meta Lead Ads',
  source_type: 'custom_webhook',
  mapping_version: 3,
});
assert.equal(canonical.external_id, 'lead-meta-001');
assert.equal(canonical.customer.name, '홍길동');
assert.equal(canonical.customer.phone, '+82 10-1234-5678');
assert.equal(canonical.customer.email, 'hong@example.com');
assert.equal(canonical.inquiry.content, '보험 상담을 요청합니다.');
assert.equal(canonical.inquiry.fields[0].value, '태아보험');
assert.equal(canonical.metadata.mappingVersion, 3);

const escaped = { 'phone/number': '01011112222', 'a~b': { value: 'ok' } };
const flattened = flattenWebhookPayload(escaped);
assert.ok(flattened.some((field) => field.pointer === '/phone~1number'));
assert.equal(getJsonPointerValue(escaped, '/phone~1number'), '01011112222');
assert.equal(getJsonPointerValue(escaped, '/a~0b/value'), 'ok');

assert.throws(
  () => validateWebhookMapping({ name: '/name' }),
  (error) => error?.code === 'CALLTAG_WEBHOOK_MAPPING_PHONE_REQUIRED'
    && error?.message === '전화번호 필드는 반드시 지정해야 합니다.',
);
assert.throws(
  () => validateWebhookMapping({ phone: 'customer.phone' }),
  (error) => error?.code === 'CALLTAG_WEBHOOK_MAPPING_PATH_INVALID'
    && error?.message.includes('JSON Pointer'),
);
assert.throws(
  () => applyWebhookMapping({ customer: { mobile: 'not-a-phone' } }, { phone: '/customer/mobile' }, {}),
  (error) => error?.code === 'CALLTAG_WEBHOOK_MAPPED_PHONE_INVALID'
    && error?.message.includes('다른 필드를 선택해주세요.'),
);

const files = {
  migration: 'migrations/0011_calltag_generic_webhook_mapper.sql',
  schema: 'functions/api/calltag/v1/_webhook-schema.js',
  mapper: 'functions/api/calltag/v1/_mapper.js',
  webhooks: 'functions/api/calltag/v1/_webhooks.js',
  connections: 'functions/api/calltag/v1/connections.js',
  samples: 'functions/api/calltag/v1/connections/[id]/samples.js',
  hook: 'functions/api/calltag/v1/hooks/[endpointKey].js',
  shared: 'functions/api/calltag/v1/_shared.js',
};
const source = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, file]) => [key, await readFile(file, 'utf8')]),
));

for (const token of [
  'CREATE TABLE IF NOT EXISTS calltag_webhook_connections',
  'endpoint_hash TEXT NOT NULL UNIQUE',
  'CREATE TABLE IF NOT EXISTS calltag_webhook_mapping_versions',
  'UNIQUE(connection_id, version)',
  'CREATE TABLE IF NOT EXISTS calltag_webhook_raw_events',
  "status IN ('RECEIVED', 'MAPPING_REQUIRED', 'MAPPED', 'REJECTED')",
  'raw_retention_days INTEGER NOT NULL DEFAULT 7',
]) {
  assert.ok(source.migration.includes(token), `webhook migration missing: ${token}`);
  assert.ok(source.schema.includes(token), `webhook runtime schema missing: ${token}`);
}
assert.ok(!source.migration.includes('endpoint_key TEXT'), 'raw webhook endpoint key must never be stored');
assert.ok(!source.schema.includes('endpoint_key TEXT'), 'runtime schema must never store raw webhook endpoint key');

for (const token of [
  "const WEBHOOK_PREFIX = 'ctwh_'",
  'endpointHash = await sha256(endpointKey)',
  'WHERE endpoint_hash = ? AND status = \'active\'',
  'readJsonLimited(request, MAX_BODY_BYTES)',
  'cleanupExpiredWebhookPayloads',
  'webhookMappingReady(mapping)',
  'applyWebhookMapping(payload, mapping, connection)',
  'intakeCanonicalLead',
  "status: 'MAPPING_REQUIRED'",
  "status: 'REJECTED'",
  'payload:${String(payloadSha',
]) {
  assert.ok(source.webhooks.includes(token), `webhook intake core missing: ${token}`);
}
for (const token of [
  '전화번호 필드는 반드시 지정해야 합니다.',
  '필드 경로는 / 로 시작하는 JSON Pointer 형식이어야 합니다.',
  '선택한 전화번호 필드의 값이 비어 있거나 전화번호 형식이 아닙니다.',
]) {
  assert.ok(source.mapper.includes(token), `friendly webhook mapper message missing: ${token}`);
}
assert.ok(source.webhooks.includes('owner_id = ? AND connection_id = ?'), 'sample reads must be owner + connection scoped');
assert.ok(source.connections.includes('callSession') && source.connections.includes('session.ownerId'), 'connection management must be signed-session scoped');
assert.ok(!source.hook.includes('callSession'), 'public webhook intake must authenticate only from the secret endpoint token');
assert.ok(source.hook.includes('receiveGenericWebhook'), 'public hook route must use generic webhook intake core');
assert.ok(source.shared.includes("export * from './_mapper.js'"));
assert.ok(source.shared.includes("export * from './_webhooks.js'"));

for (const file of [files.schema, files.mapper, files.webhooks, files.connections, files.samples, files.hook]) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(checked.status, 0, `syntax check failed for ${file}: ${checked.stderr || checked.stdout}`);
}

// `node --check` does not resolve ESM import paths. Import the route modules for real so a bad
// nested relative path cannot pass CI and then fail only in Pages Functions at runtime.
for (const file of [files.connections, files.samples, files.hook]) {
  const loaded = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', `await import('./${file}')`],
    { encoding: 'utf8' },
  );
  assert.equal(loaded.status, 0, `module import failed for ${file}: ${loaded.stderr || loaded.stdout}`);
}

console.log(JSON.stringify({
  ok: true,
  phase: 'CallTag Generic Webhook + Field Mapper Phase 2',
  contracts: [
    'hashed-secret-webhook-endpoint',
    'owner-scoped-connection-management',
    'short-lived-raw-payload-retention',
    'versioned-json-pointer-field-mapping',
    'automatic-field-suggestions',
    'mapping-required-sample-capture',
    'friendly-korean-mapping-errors',
    'canonical-lead-intake-reuse',
    'replayable-raw-samples',
    'runtime-route-import-resolution',
  ],
}, null, 2));