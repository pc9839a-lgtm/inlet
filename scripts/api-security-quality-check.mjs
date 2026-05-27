import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const server = await readFile('server/index.mjs', 'utf8');
const envExample = await readFile('.env.example', 'utf8');
const deployDoc = await readFile('docs/deploy-github-cloudflare.md', 'utf8');

for (const token of [
  'INLET_ALLOWED_ORIGINS',
  'parseAllowedOrigins',
  'requestOrigin',
  'setCors(req, res)',
  "res.setHeader('Vary', 'Origin')",
  "Access-Control-Max-Age",
  "apiAuthConfig.allowedOrigins.includes(origin)",
]) {
  assert(server.includes(token), `server CORS contract missing ${token}`);
}

assert(envExample.includes('INLET_ALLOWED_ORIGINS'), '.env.example missing INLET_ALLOWED_ORIGINS');
assert(deployDoc.includes('INLET_ALLOWED_ORIGINS'), 'deploy doc missing INLET_ALLOWED_ORIGINS');
assert(deployDoc.includes('https://inlet-8mr.pages.dev'), 'deploy doc should mention the current Pages origin example');

console.log(JSON.stringify({
  ok: true,
  checks: 10,
  cors: 'INLET_ALLOWED_ORIGINS',
}, null, 2));
