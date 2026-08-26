import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  acceptMetaWebhookRequest,
  canonicalMetaLead,
  decryptProviderCredential,
  encryptProviderCredential,
  hmacSha256Hex,
  verifyMetaWebhookChallenge,
} from '../functions/api/calltag/v1/_shared.js';

const env = {
  CALLTAG_PROVIDER_CREDENTIAL_KEY: 'qa-provider-credential-master-key-2026-08-25-at-least-32-chars',
  CALLTAG_META_APP_SECRET: 'qa-meta-app-secret-at-least-16',
  CALLTAG_META_WEBHOOK_VERIFY_TOKEN: 'qa-verify-token',
  CALLTAG_META_GRAPH_VERSION: 'v99.0',
};

const aad = 'calltag:meta-page-token:v1:owner-qa:123456789';
const rawToken = 'EAQA-test-page-access-token-never-store-plaintext';
const envelope = await encryptProviderCredential(env, rawToken, aad);
assert.ok(!envelope.includes(rawToken), 'encrypted credential envelope must not contain plaintext token');
assert.equal(await decryptProviderCredential(env, envelope, aad), rawToken);
await assert.rejects(
  () => decryptProviderCredential(env, envelope, `${aad}:wrong`),
  (error) => error?.code === 'CALLTAG_PROVIDER_CREDENTIAL_DECRYPT_FAILED',
);

const challengeRequest = new Request(
  'https://calltag.example/api/calltag/v1/meta/webhook?hub.mode=subscribe&hub.verify_token=qa-verify-token&hub.challenge=123456',
);
assert.equal(verifyMetaWebhookChallenge(challengeRequest, env), '123456');
assert.throws(
  () => verifyMetaWebhookChallenge(new Request(
    'https://calltag.example/api/calltag/v1/meta/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123456',
  ), env),
  (error) => error?.code === 'CALLTAG_META_WEBHOOK_VERIFY_FAILED',
);

const webhookBody = JSON.stringify({
  object: 'page',
  entry: [{
    id: '123456789',
    changes: [{
      field: 'leadgen',
      value: { leadgen_id: '987654321', form_id: '222333444', ad_id: '555666777' },
    }],
  }],
});
const signature = await hmacSha256Hex(env.CALLTAG_META_APP_SECRET, new TextEncoder().encode(webhookBody));
const accepted = await acceptMetaWebhookRequest(new Request(
  'https://calltag.example/api/calltag/v1/meta/webhook',
  { method: 'POST', headers: { 'X-Hub-Signature-256': `sha256=${signature}` }, body: webhookBody },
), env);
assert.deepEqual(accepted.events, [{
  pageId: '123456789', leadgenId: '987654321', formId: '222333444', adId: '555666777', createdTime: '',
}]);
await assert.rejects(
  () => acceptMetaWebhookRequest(new Request(
    'https://calltag.example/api/calltag/v1/meta/webhook',
    { method: 'POST', headers: { 'X-Hub-Signature-256': `sha256=${'0'.repeat(64)}` }, body: webhookBody },
  ), env),
  (error) => error?.code === 'CALLTAG_META_SIGNATURE_INVALID',
);

const canonical = canonicalMetaLead(
  { id: 'ctmeta_qa', page_id: '123456789', page_name: '보험 상담 페이지' },
  { pageId: '123456789', leadgenId: '987654321', formId: '222333444', adId: '555666777' },
  {
    id: '987654321',
    created_time: '2026-08-25T01:02:03+0000',
    form_id: '222333444',
    ad_id: '555666777',
    field_data: [
      { name: 'full_name', values: ['홍길동'] },
      { name: 'phone_number', values: ['+82 10-1234-5678'] },
      { name: 'email', values: ['hong@example.com'] },
      { name: 'insurance_question', values: ['태아보험 상담 희망'] },
    ],
  },
);
assert.equal(canonical.external_id, '987654321');
assert.equal(canonical.source.type, 'meta_lead_ads');
assert.equal(canonical.source.provider, 'meta');
assert.equal(canonical.customer.name, '홍길동');
assert.equal(canonical.customer.phone, '+82 10-1234-5678');
assert.equal(canonical.customer.email, 'hong@example.com');
assert.equal(canonical.inquiry.content, '태아보험 상담 희망');
assert.equal(canonical.metadata.pageId, '123456789');

const files = {
  migration: 'migrations/0012_calltag_meta_lead_ads.sql',
  credentials: 'functions/api/calltag/v1/_credentials.js',
  schema: 'functions/api/calltag/v1/_meta-schema.js',
  meta: 'functions/api/calltag/v1/_meta.js',
  connections: 'functions/api/calltag/v1/meta/connections.js',
  webhook: 'functions/api/calltag/v1/meta/webhook.js',
  shared: 'functions/api/calltag/v1/_shared.js',
};
const source = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, file]) => [key, await readFile(file, 'utf8')]),
));

for (const token of [
  'CREATE TABLE IF NOT EXISTS calltag_meta_connections',
  'page_id TEXT NOT NULL UNIQUE',
  'credential_envelope TEXT NOT NULL',
  "status IN ('active', 'revoked', 'error')",
]) {
  assert.ok(source.migration.includes(token), `Meta migration missing: ${token}`);
  assert.ok(source.schema.includes(token), `Meta runtime schema missing: ${token}`);
}
assert.ok(!source.migration.includes('page_access_token'), 'migration must never store plaintext page access token column');
assert.ok(!source.schema.includes('page_access_token'), 'runtime schema must never store plaintext page access token column');

for (const token of [
  "env.CALLTAG_PROVIDER_CREDENTIAL_KEY",
  "name: 'AES-GCM'",
  'tagLength: 128',
  'timingSafeEqualText',
]) assert.ok(source.credentials.includes(token), `credential helper missing: ${token}`);

for (const token of [
  "X-Hub-Signature-256",
  "payload.object !== 'page'",
  "change?.field || '') !== 'leadgen'",
  'WHERE page_id = ? AND status IN',
  'decryptProviderCredential',
  'Authorization: `Bearer ${token}`',
  "url.searchParams.set('fields'",
  'intakeCanonicalLead',
  'notifyUniversalLeadAvailable',
  "sourceType: 'meta_lead_ads'",
]) assert.ok(source.meta.includes(token), `Meta core missing: ${token}`);
assert.ok(!source.meta.includes("url.searchParams.set('access_token'"), 'Meta token must not be placed in Graph URL query string');
assert.ok(source.meta.includes("String(existing.owner_id) !== safeOwnerId"), 'Page ownership collision must not silently reassign tenant');
assert.ok(source.connections.includes('callSession') && source.connections.includes('session.ownerId'), 'Meta connection management must be signed-session scoped');
assert.ok(!source.webhook.includes('callSession'), 'public Meta webhook must not trust a CallTag session/body owner');
assert.ok(source.webhook.includes('context.waitUntil(work)'), 'Meta webhook should acknowledge quickly and process after signature verification');
assert.ok(source.shared.includes("export * from './_credentials.js'"));
assert.ok(source.shared.includes("export * from './_meta.js'"));

for (const file of [files.credentials, files.schema, files.meta, files.connections, files.webhook]) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(checked.status, 0, `syntax check failed for ${file}: ${checked.stderr || checked.stdout}`);
  const loaded = spawnSync(process.execPath, ['--input-type=module', '--eval', `await import('./${file}')`], { encoding: 'utf8' });
  assert.equal(loaded.status, 0, `module import failed for ${file}: ${loaded.stderr || loaded.stdout}`);
}

console.log(JSON.stringify({
  ok: true,
  phase: 'CallTag Meta Lead Ads Phase 4 server core',
  contracts: [
    'aes-256-gcm-provider-credential-envelope',
    'no-plaintext-page-token-at-rest',
    'meta-webhook-challenge-verification',
    'raw-body-hmac-sha256-verification',
    'server-page-to-owner-resolution',
    'bearer-token-graph-fetch-without-token-url',
    'meta-field-data-to-canonical-lead',
    'canonical-dedupe-by-leadgen-id',
    'pii-free-generic-fcm-trigger',
    'runtime-route-import-resolution',
  ],
}, null, 2));
