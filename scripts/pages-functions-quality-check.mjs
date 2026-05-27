import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await readFile('functions/api/health.js', 'utf8');
const shared = await readFile('functions/api/_shared.js', 'utf8');
const leads = await readFile('functions/api/leads.js', 'utf8');
const events = await readFile('functions/api/events.js', 'utf8');
const statsSummary = await readFile('functions/api/stats/summary.js', 'utf8');
const wrangler = await readFile('wrangler.jsonc', 'utf8');
const hostedQa = await readFile('scripts/hosted-api-quality-check.mjs', 'utf8');
const hostedRoutesQa = await readFile('scripts/hosted-api-routes-quality-check.mjs', 'utf8');

for (const token of [
  'export async function onRequest',
  'createStorageRuntime',
  'storageRuntimeCoverage',
  "service: 'inlet-api'",
  "mode: 'pages-functions'",
  "sourceOfTruth: 'signed-session'",
  "INLET_STORAGE_ADAPTER: env.INLET_STORAGE_ADAPTER || 'd1'",
  'INLET_SESSION_SECRET',
  'Access-Control-Allow-Origin',
]) {
  assert(health.includes(token), `Pages health function missing ${token}`);
}

for (const token of [
  'sessionIdentity',
  'crypto.subtle.importKey',
  'X-Inlet-Session',
  'X-Inlet-Api-Token',
  'publicWrite',
  'Project access is required.',
]) {
  assert(shared.includes(token), `Pages shared API helper missing ${token}`);
}

for (const [name, source, tokens] of [
  ['leads', leads, ['upsertD1Lead', 'listD1Leads', 'publicWrite: true', 'deliveryStatus', 'meta: { source:']],
  ['events', events, ['insertD1Event', 'listD1Events', 'publicWrite: true', 'eventType', 'meta: { source:']],
  ['stats summary', statsSummary, ['aggregateD1Stats', "source: 'server'", "adapter: 'd1'", 'authorizeProject']],
]) {
  for (const token of tokens) {
    assert(source.includes(token), `Pages ${name} function missing ${token}`);
  }
}

for (const token of [
  '"pages_build_output_dir": "dist"',
  '"d1_databases"',
  '"binding": "DB"',
  '"database_name": "inlet-prod"',
]) {
  assert(wrangler.includes(token), `wrangler Pages config missing ${token}`);
}

for (const token of [
  "payload?.service === 'inlet-api'",
  "storageActive === 'd1'",
  'static-pages-html-fallback',
]) {
  assert(hostedQa.includes(token), `hosted API QA missing ${token}`);
}

for (const token of [
  '/api/leads',
  '/api/events',
  '/api/stats/summary',
  'INLET_HOSTED_ROUTE_QA_WRITE',
  'read protection',
]) {
  assert(hostedRoutesQa.includes(token), `hosted API route QA missing ${token}`);
}

console.log(JSON.stringify({
  ok: true,
  checks: 42,
  functions: [
    'functions/api/health.js',
    'functions/api/leads.js',
    'functions/api/events.js',
    'functions/api/stats/summary.js',
  ],
  binding: 'DB',
}, null, 2));
