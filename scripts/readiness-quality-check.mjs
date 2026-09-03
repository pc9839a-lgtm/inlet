import { readFile } from 'node:fs/promises';
import { onRequest } from '../functions/api/readiness.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const REQUIRED_TABLES = ['accounts', 'projects', 'pages', 'leads'];

function request(method = 'GET') {
  return new Request('https://pagero.kr/api/readiness', { method });
}

function healthyDb(options = {}) {
  const missing = new Set(options.missingTables || []);
  return {
    prepare(sql) {
      const text = String(sql || '');
      if (/SELECT\s+1\s+AS\s+ok/i.test(text)) {
        return {
          async first() {
            if (options.queryError) throw Object.assign(new Error('mock d1 failure'), { code: 'D1_MOCK_FAILURE' });
            return { ok: 1 };
          },
        };
      }
      if (/sqlite_master/i.test(text)) {
        return {
          bind(...names) {
            return {
              async all() {
                return {
                  results: names
                    .filter((name) => !missing.has(name))
                    .map((name) => ({ name })),
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected readiness query: ${text}`);
    },
  };
}

async function payload(response) {
  return response.json();
}

{
  const response = await onRequest({
    request: request(),
    env: { INLET_SESSION_SECRET: 'qa-secret', DB: healthyDb() },
  });
  const body = await payload(response);
  assert(response.status === 200, 'healthy readiness must return 200');
  assert(body.ok === true && body.ready === true, 'healthy readiness must be ready');
  assert(body.checks?.d1?.bindingReady === true, 'D1 binding must be ready');
  assert(body.checks?.d1?.queryReady === true, 'D1 query must be ready');
  assert(body.checks?.d1?.schemaReady === true, 'D1 schema must be ready');
  assert(body.checks?.session?.ready === true, 'session secret must be ready');
  assert(body.checks?.session?.source === 'session-secret', 'session-secret source must be reported');
  assert(body.checks?.session?.insecureFallbackEnabled === false, 'insecure fallback must stay disabled');
}

{
  const response = await onRequest({ request: request(), env: { INLET_SESSION_SECRET: 'qa-secret' } });
  const body = await payload(response);
  assert(response.status === 503, 'missing D1 binding must return 503');
  assert(body.checks?.d1?.reason === 'd1-binding-missing', 'missing D1 binding reason must be explicit');
}

{
  const response = await onRequest({ request: request(), env: { DB: healthyDb() } });
  const body = await payload(response);
  assert(response.status === 503, 'missing session secret must return 503');
  assert(body.checks?.session?.ready === false, 'missing session secret must not be ready');
  assert(body.checks?.session?.source === 'missing', 'missing secret source must be explicit');
}

{
  const response = await onRequest({
    request: request(),
    env: { INLET_API_TOKEN: 'qa-token', DB: healthyDb() },
  });
  const body = await payload(response);
  assert(response.status === 200, 'explicit API token may provide session secret readiness');
  assert(body.checks?.session?.source === 'api-token', 'API token source must be reported');
}

{
  const response = await onRequest({
    request: request(),
    env: { INLET_SESSION_SECRET: 'qa-secret', DB: healthyDb({ missingTables: ['pages'] }) },
  });
  const body = await payload(response);
  assert(response.status === 503, 'missing core D1 table must return 503');
  assert(body.checks?.d1?.reason === 'd1-schema-incomplete', 'schema failure reason must be explicit');
  assert(body.checks?.d1?.missingTables?.length === 1 && body.checks.d1.missingTables[0] === 'pages', 'only missing table names may be exposed');
}

{
  const response = await onRequest({
    request: request(),
    env: { INLET_SESSION_SECRET: 'qa-secret', DB: healthyDb({ queryError: true }) },
  });
  const body = await payload(response);
  assert(response.status === 503, 'D1 query failure must return 503');
  assert(body.checks?.d1?.reason === 'd1-query-failed', 'D1 query failure reason must be explicit');
  assert(!JSON.stringify(body).includes('mock d1 failure'), 'raw D1 error message must not be exposed');
}

{
  const response = await onRequest({
    request: request('POST'),
    env: { INLET_SESSION_SECRET: 'qa-secret', DB: healthyDb() },
  });
  assert(response.status === 405, 'readiness must be read-only GET');
}

const source = await readFile('functions/api/readiness.js', 'utf8');
for (const table of REQUIRED_TABLES) {
  assert(source.includes(`'${table}'`), `readiness core schema check missing ${table}`);
}
assert(!/\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|REPLACE\s+INTO)\b/i.test(source), 'readiness endpoint must not contain write SQL');
assert(source.includes("'Cache-Control': 'no-store'"), 'readiness response must not be cached');

const workflow = await readFile('.github/workflows/deploy-cloudflare.yml', 'utf8');
for (const token of [
  'Ensure production session secret',
  'wrangler pages secret list --project-name inlet',
  'openssl rand -hex 64',
  'wrangler pages secret put INLET_SESSION_SECRET --project-name inlet',
  'unset session_secret',
  'Verify deployed readiness',
  '/api/readiness',
  'pagero.kr/api/readiness',
  'deployment_not_ready',
  'steps.readiness.outcome',
  "grep -Eo 'https://[a-z0-9]+\\.inlet-8mr\\.pages\\.dev'",
  'probe_readiness "$deployment_url/api/readiness" exact-deployment',
]) {
  assert(workflow.includes(token), `deployment readiness/security gate missing ${token}`);
}
assert(workflow.indexOf('Ensure production session secret') < workflow.indexOf('Deploy assets and Pages Functions'), 'session secret bootstrap must happen before deploy');
assert(!workflow.includes('echo "$session_secret"'), 'session secret value must never be echoed');
assert(!workflow.includes('set -x'), 'deployment workflow must not enable shell xtrace around secrets');
assert(/openssl rand -hex 64/.test(workflow), 'generated session secret must provide 512 bits of random material');

console.log(JSON.stringify({
  ok: true,
  check: 'pagero-readiness',
  readOnly: true,
  requiredTables: REQUIRED_TABLES,
  failClosed: true,
  deploymentProbe: true,
  exactDeploymentProbe: true,
  sessionSecretBootstrap: true,
  generatedSecretBits: 512,
  secretValueLogged: false,
}, null, 2));
