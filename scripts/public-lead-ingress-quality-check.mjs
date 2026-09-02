import { readFile } from 'node:fs/promises';
import {
  PUBLIC_LEAD_BURST_LIMIT,
  PUBLIC_LEAD_COOLDOWN_MS,
  PUBLIC_LEAD_MAX_BODY_BYTES,
  guardPublicLeadIngress,
  resetPublicLeadIngressForTests,
} from '../functions/api/_publicLeadIngress.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function leadRequest({ ip = '203.0.113.10', body = '{"ok":true}' } = {}) {
  return new Request('https://pagero.kr/api/leads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ip ? { 'CF-Connecting-IP': ip } : {}),
    },
    body,
  });
}

resetPublicLeadIngressForTests();
const normal = await guardPublicLeadIngress(leadRequest(), 1_000);
assert(normal === null, 'normal public lead payload should pass ingress guard');

resetPublicLeadIngressForTests();
const declaredOversize = await guardPublicLeadIngress({
  headers: {
    get(name) {
      if (String(name).toLowerCase() === 'content-length') return String(PUBLIC_LEAD_MAX_BODY_BYTES + 1);
      return '';
    },
  },
}, 2_000);
assert(declaredOversize?.status === 413, 'declared oversized public lead payload should be rejected before body parsing');
const declaredPayload = await declaredOversize.json();
assert(declaredPayload.code === 'LEAD_PAYLOAD_TOO_LARGE', 'oversized lead response should expose stable error code');
assert(declaredOversize.headers.get('cache-control') === 'no-store', 'ingress rejection must not be cached');
assert(declaredOversize.headers.get('access-control-allow-origin') === '*', 'public lead ingress rejection should remain CORS-readable');

resetPublicLeadIngressForTests();
for (let index = 0; index < PUBLIC_LEAD_BURST_LIMIT; index += 1) {
  const allowed = await guardPublicLeadIngress(leadRequest({ ip: '198.51.100.22' }), 10_000 + index);
  assert(allowed === null, `burst request ${index + 1} should stay within generous edge limit`);
}
const burstBlocked = await guardPublicLeadIngress(leadRequest({ ip: '198.51.100.22' }), 10_100);
assert(burstBlocked?.status === 429, 'request above burst threshold should be rejected before downstream API work');
const burstPayload = await burstBlocked.json();
assert(burstPayload.code === 'LEAD_INGRESS_RATE_LIMITED', 'burst rejection should expose stable rate-limit code');
assert(Number(burstBlocked.headers.get('retry-after')) === Math.ceil(PUBLIC_LEAD_COOLDOWN_MS / 1000), 'burst rejection should include Retry-After');

const stillBlocked = await guardPublicLeadIngress(leadRequest({ ip: '198.51.100.22' }), 20_000);
assert(stillBlocked?.status === 429, 'same edge client should remain blocked during cooldown');
const afterCooldown = await guardPublicLeadIngress(leadRequest({ ip: '198.51.100.22' }), 10_100 + PUBLIC_LEAD_COOLDOWN_MS + 1);
assert(afterCooldown === null, 'edge burst limiter should recover automatically after cooldown');

resetPublicLeadIngressForTests();
for (let index = 0; index < PUBLIC_LEAD_BURST_LIMIT + 5; index += 1) {
  const withoutIp = await guardPublicLeadIngress(leadRequest({ ip: '' }), 50_000 + index);
  assert(withoutIp === null, 'missing edge IP must not collapse unrelated clients into one shared limiter bucket');
}

const middleware = await readFile('functions/api/_middleware.js', 'utf8');
const ingressSource = await readFile('functions/api/_publicLeadIngress.js', 'utf8');
assert(middleware.includes("import { guardPublicLeadIngress } from './_publicLeadIngress.js';"), 'API middleware should own public lead ingress guard');
assert(middleware.indexOf('guardPublicLeadIngress(request)') < middleware.indexOf('request.clone().json()'), 'ingress guard must run before public lead JSON parsing');
assert(middleware.indexOf('guardPublicLeadIngress(request)') < middleware.indexOf('const response = await next()'), 'ingress guard must run before downstream D1/delivery work');
assert(ingressSource.includes('PUBLIC_LEAD_MAX_BODY_BYTES = 128 * 1024'), 'public lead declared body cap should remain explicit and bounded');
assert(ingressSource.includes('PUBLIC_LEAD_BURST_LIMIT = 20') && ingressSource.includes('PUBLIC_LEAD_BURST_WINDOW_MS = 5_000'), 'edge burst threshold should remain generous enough for legitimate traffic');
assert(ingressSource.includes('stableHash(ip)') && !ingressSource.includes('console.'), 'ingress limiter must avoid logging or retaining raw client IPs');
assert(!ingressSource.includes('request.clone()') && !ingressSource.includes('getReader()'), 'ingress guard must not pre-read or tee the downstream request body');
assert(!/D1|\.prepare\(|INSERT INTO|UPDATE /.test(ingressSource), 'ingress abuse guard must not amplify blocked traffic into database writes');

console.log(JSON.stringify({
  ok: true,
  checks: 17,
  maxDeclaredBodyBytes: PUBLIC_LEAD_MAX_BODY_BYTES,
  burstLimit: PUBLIC_LEAD_BURST_LIMIT,
  cooldownMs: PUBLIC_LEAD_COOLDOWN_MS,
  requestBodyPreRead: false,
}, null, 2));
