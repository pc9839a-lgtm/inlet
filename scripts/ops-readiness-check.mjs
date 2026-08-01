import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const requiredDocs = [
  'docs/ops-storage-migration-policy.md',
  'docs/ops-pii-retention-export-policy.md',
  'docs/ops-operator-readiness-checklist.md',
  'docs/ops-live-integration-matrix.md',
  'docs/ops-deployment-cache-seo-checklist.md',
  'docs/ops-custom-domain-runbook.md',
];

const requiredEnvHints = [
  'VITE_INLET_API_BASE',
  'VITE_INLET_API_TOKEN',
  'INLET_API_TOKEN',
  'INLET_SESSION_AUTH_MODE',
  'INLET_SESSION_SECRET',
  'INLET_PUBLIC_API_URL',
  'INLET_HOSTED_API_QA_REQUIRE',
  'INLET_HOSTED_API_EXPECT_D1',
  'OPENAI_API_KEY',
  'INLET_AUTH_EMAIL_MODE',
  'INLET_EMAIL_PROVIDER',
  'AWS_SES_REGION',
  'AWS_SES_ACCESS_KEY_ID',
  'AWS_SES_SECRET_ACCESS_KEY',
  'INLET_AUTH_EMAIL_FROM',
  'VITE_INLET_MAP_EMBED_BASE',
  'VITE_GOOGLE_MAPS_EMBED_KEY',
  'INLET_CLOUDFLARE_ACCOUNT_ID',
  'INLET_CLOUDFLARE_PAGES_PROJECT',
  'INLET_CLOUDFLARE_API_TOKEN',
  'INLET_CUSTOM_DOMAIN_CNAME_TARGET',
  'INLET_DOMAIN_RECHECK_SECRET',
  'INLET_DOMAIN_RECHECK_BATCH_SIZE',
  'INLET_DOMAIN_RECHECK_MAX_RETRIES',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

const docs = [];
for (const file of requiredDocs) {
  const content = await read(file);
  assert(content.trim().length > 500, `${file} is too short`);
  assert(content.includes('Implementation Tasks') || content.includes('Local Commands') || content.includes('Live-Only Checks'), `${file} lacks actionable sections`);
  docs.push(file);
}

const envExample = await read('.env.example');
for (const key of requiredEnvHints) {
  assert(envExample.includes(key), `.env.example missing ${key}`);
}

const readiness = await read('docs/ops-operator-readiness-checklist.md');
for (const command of [
  'npm run integration:mock:qa',
  'npm run server:smoke:auth',
  'npm run server:smoke:leads',
  'npm run server:smoke:events',
  'npm run server:smoke:pages',
  'npm run server:smoke:integrations',
  'npm run api:hosted:qa',
  'npm run artifact:clean',
  'npm run artifact:qa -- --strict',
]) {
  assert(readiness.includes(command), `operator checklist missing ${command}`);
}
for (const liveGate of [
  'Live Credential Gate',
  'OPENAI_API_KEY',
  'server-unreachable',
  'missing-key',
  'bad-model-response',
  'INLET_SESSION_AUTH_MODE=strict',
  'INLET_SESSION_SECRET',
  'AWS_SES_REGION',
  'AWS_SES_SECRET_ACCESS_KEY',
  'idempotency key',
  'OAuth',
  'Conversion tracking',
  'Map wrapper',
  'INLET_PRODUCTION_BROWSER_QA_REQUIRE=1',
  'INLET_PRODUCTION_QA_INCLUDE_NEXT_SETTINGS=1',
  'requireRealBrowser=true',
  'Cloudflare Pages deployment id',
  'GitHub `main` commit SHA',
  'Settings duplicate policy/page duplication modal coverage',
]) {
  assert(readiness.includes(liveGate), `operator checklist missing live gate detail: ${liveGate}`);
}

const matrix = await read('docs/ops-live-integration-matrix.md');
for (const label of ['skipped-live', 'AWS SES', 'External webhook', 'AI live generation', 'GTM', 'integration:mock:qa', 'Live Phase Acceptance']) {
  assert(matrix.includes(label), `integration matrix missing ${label}`);
}
for (const label of ['liveSummary', 'liveSummary.fail', 'liveSummary.skipped-live']) {
  assert(matrix.includes(label), `integration matrix missing live summary policy: ${label}`);
}
assert(readiness.includes('liveSummary'), 'operator checklist missing liveSummary sign-off evidence');

const customDomainRunbook = await read('docs/ops-custom-domain-runbook.md');
for (const token of [
  '0006_page_domains.sql',
  '0007_page_domain_operations.sql',
  '/api/admin/domains',
  '/api/admin/domains/recheck',
  'PAGERO_DOMAIN_RECHECK_SECRET',
  'Detach And Reconnect',
  'Rollback',
]) {
  assert(customDomainRunbook.includes(token), `custom-domain runbook missing ${token}`);
}

console.log(JSON.stringify({
  ok: true,
  docs: docs.length,
  envHints: requiredEnvHints.length,
}, null, 2));
