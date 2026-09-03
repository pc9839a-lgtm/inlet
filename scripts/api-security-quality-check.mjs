import { readFile } from 'node:fs/promises';
import { onRequest as apiMiddleware } from '../functions/api/_middleware.js';
import { onRequest as healthRequest } from '../functions/api/health.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const server = await readFile('server/index.mjs', 'utf8');
const envExample = await readFile('.env.example', 'utf8');
const deployDoc = await readFile('docs/deploy-github-cloudflare.md', 'utf8');
const middleware = await readFile('functions/api/_middleware.js', 'utf8');
const health = await readFile('functions/api/health.js', 'utf8');

for (const token of [
  'INLET_ALLOWED_ORIGINS',
  'parseAllowedOrigins',
  'requestOrigin',
  'setCors(req, res)',
  "res.setHeader('Vary', 'Origin')",
  'Access-Control-Max-Age',
  'apiAuthConfig.allowedOrigins.includes(origin)',
]) {
  assert(server.includes(token), `server CORS contract missing ${token}`);
}

assert(envExample.includes('INLET_ALLOWED_ORIGINS'), '.env.example missing INLET_ALLOWED_ORIGINS');
assert(deployDoc.includes('INLET_ALLOWED_ORIGINS'), 'deploy doc missing INLET_ALLOWED_ORIGINS');
assert(deployDoc.includes('https://pagero.kr'), 'deploy doc should mention the current production origin');

for (const token of [
  'configuredSessionSecret',
  'requestNeedsConfiguredSessionSecret',
  'AUTH_SESSION_SECRET_MISSING',
  "env.INLET_SESSION_SECRET || env.INLET_API_TOKEN || ''",
  "url.pathname.startsWith('/api/auth/')",
  "request.headers.get('X-Inlet-Session')",
]) {
  assert(middleware.includes(token), `Pages API fail-closed session contract missing ${token}`);
}
assert(!middleware.includes("env.INLET_SESSION_SECRET || env.INLET_API_TOKEN || 'inlet-local-auth-secret'"), 'middleware must not use predictable production session fallback');
assert(health.includes('sessionSecurityStatus'), 'health must derive explicit session security readiness');
assert(health.includes('insecureFallbackEnabled: false'), 'health must report insecure fallback disabled');
assert(!health.includes("INLET_SESSION_SECRET || env.INLET_API_TOKEN || 'inlet-local-auth-secret'"), 'health must not report predictable fallback as ready');

let nextCalls = 0;
const missingSecretAuthResponse = await apiMiddleware({
  request: new Request('https://pagero.kr/api/auth/login', { method: 'POST' }),
  env: {},
  next: async () => {
    nextCalls += 1;
    return new Response(null, { status: 204 });
  },
});
const missingSecretAuthPayload = await missingSecretAuthResponse.json();
assert(missingSecretAuthResponse.status === 503, 'auth API must fail closed when session secret is missing');
assert(missingSecretAuthPayload.code === 'AUTH_SESSION_SECRET_MISSING', 'missing session secret must return stable error code');
assert(nextCalls === 0, 'missing session secret must block auth handler execution');

const missingSecretSessionResponse = await apiMiddleware({
  request: new Request('https://pagero.kr/api/pages', {
    method: 'GET',
    headers: { 'X-Inlet-Session': 'forged.payload' },
  }),
  env: {},
  next: async () => {
    nextCalls += 1;
    return new Response(null, { status: 204 });
  },
});
assert(missingSecretSessionResponse.status === 503, 'session-bearing API must fail closed when session secret is missing');
assert(nextCalls === 0, 'forged session request must not reach handler without configured secret');

const publicResponse = await apiMiddleware({
  request: new Request('https://pagero.kr/api/public-page?slug=test', { method: 'GET' }),
  env: {},
  next: async () => {
    nextCalls += 1;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});
assert(publicResponse.status === 200, 'sessionless public API must remain available without session secret');
assert(nextCalls === 1, 'sessionless public API should still reach handler');

const configuredAuthResponse = await apiMiddleware({
  request: new Request('https://pagero.kr/api/auth/login', { method: 'POST' }),
  env: { INLET_SESSION_SECRET: 'qa-session-secret' },
  next: async () => {
    nextCalls += 1;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});
assert(configuredAuthResponse.status === 200, 'configured session secret must allow auth handler execution');
assert(nextCalls === 2, 'configured auth request should reach handler exactly once');

const healthMissing = await healthRequest({
  request: new Request('https://pagero.kr/api/health'),
  env: {},
});
const healthMissingPayload = await healthMissing.json();
assert(healthMissingPayload.auth?.signedSessionReady === false, 'health must report missing session secret as not ready');
assert(healthMissingPayload.auth?.sessionSecretSource === 'missing', 'health must report missing session secret source');
assert(healthMissingPayload.auth?.insecureFallbackEnabled === false, 'health must report insecure fallback disabled');

const healthConfigured = await healthRequest({
  request: new Request('https://pagero.kr/api/health'),
  env: { INLET_API_TOKEN: 'qa-api-token' },
});
const healthConfiguredPayload = await healthConfigured.json();
assert(healthConfiguredPayload.auth?.signedSessionReady === true, 'health must report configured API token as session-ready fallback source');
assert(healthConfiguredPayload.auth?.sessionSecretSource === 'api-token', 'health must report API token session source without exposing the token');

await import('./readiness-quality-check.mjs');

console.log(JSON.stringify({
  ok: true,
  checks: 32,
  cors: 'INLET_ALLOWED_ORIGINS',
  sessionSecurity: 'fail-closed',
  predictableFallbackAccepted: false,
  publicApiPreserved: true,
  deploymentReadinessGated: true,
}, null, 2));
