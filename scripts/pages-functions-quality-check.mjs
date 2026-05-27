import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await readFile('functions/api/health.js', 'utf8');
const wrangler = await readFile('wrangler.jsonc', 'utf8');
const hostedQa = await readFile('scripts/hosted-api-quality-check.mjs', 'utf8');

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

console.log(JSON.stringify({
  ok: true,
  checks: 16,
  function: 'functions/api/health.js',
  binding: 'DB',
}, null, 2));
