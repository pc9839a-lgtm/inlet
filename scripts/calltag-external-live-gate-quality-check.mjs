import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [readiness, smoke, deploy] = await Promise.all([
  readFile('functions/api/calltag/v1/readiness.js', 'utf8'),
  readFile('scripts/calltag-external-production-smoke.mjs', 'utf8'),
  readFile('.github/workflows/deploy-cloudflare.yml', 'utf8'),
]);

for (const table of [
  'calltag_lead_customers',
  'calltag_lead_events',
  'calltag_api_keys',
  'calltag_webhook_connections',
  'calltag_meta_connections',
  'calltag_google_forms_connections',
  'calltag_push_devices',
  'calltag_pagero_leads',
]) {
  assert.ok(readiness.includes(table), `CallTag readiness table missing: ${table}`);
}

for (const token of [
  'CALLTAG_PROVIDER_CREDENTIAL_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'CALLTAG_META_APP_ID',
  'CALLTAG_META_APP_SECRET',
  'CALLTAG_META_OAUTH_REDIRECT_URI',
  'providerCredentialEncryption',
  'nativeOauthReady',
  'metaRequiredForCore: false',
]) {
  assert.ok(readiness.includes(token), `CallTag readiness runtime contract missing: ${token}`);
}

assert.doesNotMatch(readiness, /JSON\.stringify\([^\n]*(?:CALLTAG_PROVIDER_CREDENTIAL_KEY|CALLTAG_META_APP_SECRET|GOOGLE_CLIENT_SECRET)/);
assert.ok(readiness.includes('valuesExposed: false'), 'Readiness must explicitly state that secret values are not exposed');

for (const token of [
  '/api/qa/production-save-session',
  'X-Inlet-Production-QA-Secret',
  '/api/calltag/v1/connections',
  '/api/calltag/v1/keys',
  '/api/calltag/v1/meta/connections',
  '/api/calltag/v1/google-forms/connections',
  '/api/calltag/v1/readiness',
  "action: 'revoke'",
  "sourceName: 'CallTag QA'",
  "name: 'webhook-create'",
  "readiness.data?.checks?.meta?.oauthReady !== true",
  "readiness.data?.checks?.firebase?.ready !== true",
  "'/api/call/push/readiness'",
  "pushReadiness.data?.ready !== true",
  "apiKey.startsWith('ctk_')",
  "endpointUrl.includes('/api/calltag/v1/hooks/ctwh_')",
  'cleanupResidue',
  'secretsExposed: false',
]) {
  assert.ok(smoke.includes(token), `CallTag production smoke contract missing: ${token}`);
}

assert.doesNotMatch(smoke, /console\.(?:log|error)\([^\n]*(?:apiKey|endpointUrl|qaSecret|session)/i, 'Production smoke must not log live secrets');
assert.doesNotMatch(smoke, /process\.stdout\.write\([^\n]*(?:apiKey|endpointUrl|qaSecret|session)/i, 'Production smoke evidence must not expose live secrets');

for (const token of [
  'Verify CallTag external integration CRUD',
  'calltag_external_smoke',
  'scripts/calltag-external-production-smoke.mjs',
  'calltag-external-production-smoke-result.json',
  'calltag_external_integration_smoke_failed',
  'CallTag external integration CRUD',
]) {
  assert.ok(deploy.includes(token), `Cloudflare deploy gate missing: ${token}`);
}

assert.match(
  deploy,
  /steps\.calltag_external_smoke\.outcome != 'success'/,
  'Production deploy must fail if the CallTag external CRUD smoke fails',
);

console.log(JSON.stringify({
  ok: true,
  phase: 'CallTag external integration production gate',
  contracts: [
    'runtime-d1-schema-readiness',
    'provider-secret-name-readiness-only',
    'meta-readiness-required-at-production-release',
    'firebase-configuration-and-D1-push-readiness-required',
    'authenticated-webhook-crud',
    'authenticated-direct-api-key-crud',
    'generic-webhook-smoke-not-google-forms-E2E',
    'qa-fixture-session-only',
    'best-effort-residue-cleanup',
    'no-secret-evidence-output',
    'production-deploy-fail-closed',
  ],
}, null, 2));
