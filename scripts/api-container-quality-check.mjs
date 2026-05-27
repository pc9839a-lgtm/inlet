import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const dockerfile = await readFile('Dockerfile.api', 'utf8');
const deployDoc = await readFile('docs/deploy-github-cloudflare.md', 'utf8');
const opsDoc = await readFile('docs/ops-operator-readiness-checklist.md', 'utf8');

for (const token of [
  'FROM node:24-alpine',
  'ENV NODE_ENV=production',
  'ENV INLET_API_PORT=8787',
  'ENV INLET_DATA_DIR=/data',
  'COPY server ./server',
  'COPY src ./src',
  'EXPOSE 8787',
  'HEALTHCHECK',
  '/api/health',
  'CMD ["npm", "run", "server"]',
]) {
  assert(dockerfile.includes(token), `Dockerfile.api missing ${token}`);
}

for (const token of [
  'docker build -f Dockerfile.api',
  'docker run --rm -p 8787:8787',
  'INLET_SESSION_AUTH_MODE=production',
  'INLET_STORAGE_ADAPTER=d1',
  'storage.coverage',
]) {
  assert(deployDoc.includes(token), `deploy doc missing ${token}`);
}

for (const token of [
  'node --check server/index.mjs',
  'npm run live:qa',
  'auth.sourceOfTruth=signed-session',
]) {
  assert(opsDoc.includes(token), `operator checklist missing ${token}`);
}

console.log(JSON.stringify({
  ok: true,
  checks: 18,
  dockerfile: 'Dockerfile.api',
  healthcheck: '/api/health',
}, null, 2));
