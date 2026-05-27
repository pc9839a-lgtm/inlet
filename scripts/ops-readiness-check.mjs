import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const requiredDocs = [
  'docs/ops-storage-migration-policy.md',
  'docs/ops-pii-retention-export-policy.md',
  'docs/ops-operator-readiness-checklist.md',
  'docs/ops-live-integration-matrix.md',
  'docs/ops-deployment-cache-seo-checklist.md',
];

const requiredEnvHints = [
  'VITE_INLET_API_BASE',
  'VITE_INLET_API_TOKEN',
  'INLET_API_TOKEN',
  'INLET_SESSION_AUTH_MODE',
  'INLET_SESSION_SECRET',
  'OPENAI_API_KEY',
  'INLET_SMTP_HOST',
  'INLET_SMTP_USER',
  'INLET_SMTP_PASS',
  'VITE_INLET_MAP_EMBED_BASE',
  'VITE_GOOGLE_MAPS_EMBED_KEY',
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
  'INLET_SMTP_HOST',
  'INLET_SMTP_PASS',
  'idempotency key',
  'OAuth',
  'Conversion tracking',
  'Map wrapper',
]) {
  assert(readiness.includes(liveGate), `operator checklist missing live gate detail: ${liveGate}`);
}

const matrix = await read('docs/ops-live-integration-matrix.md');
for (const label of ['skipped-live', 'SMTP', 'External webhook', 'AI live generation', 'GTM', 'integration:mock:qa', 'Live Phase Acceptance']) {
  assert(matrix.includes(label), `integration matrix missing ${label}`);
}
for (const label of ['liveSummary', 'liveSummary.fail', 'liveSummary.skipped-live']) {
  assert(matrix.includes(label), `integration matrix missing live summary policy: ${label}`);
}
assert(readiness.includes('liveSummary'), 'operator checklist missing liveSummary sign-off evidence');

console.log(JSON.stringify({
  ok: true,
  docs: docs.length,
  envHints: requiredEnvHints.length,
}, null, 2));
