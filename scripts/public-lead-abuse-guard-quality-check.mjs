import { readFile } from 'node:fs/promises';
import {
  evaluatePublicLeadAbuse,
  publicLeadAbuseConfig,
  publicLeadAbuseResponse,
  publicLeadRequestIpHash,
} from '../functions/api/_publicLeadAbuseGuard.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function dbWithCounts({ burstCount = 0, dailyCount = 0, fail = false } = {}) {
  let calls = 0;
  let sql = '';
  return {
    get calls() { return calls; },
    get sql() { return sql; },
    prepare(source) {
      calls += 1;
      sql = String(source || '');
      return {
        bind(...params) {
          return {
            async first() {
              if (fail) {
                const error = new Error('sensitive-db-message-010-9999-9999');
                error.code = 'D1_TEMPORARY';
                throw error;
              }
              assert(params.length === 8, 'abuse query must bind hashed IP and time windows only');
              return { burst_count: burstCount, daily_count: dailyCount };
            },
          };
        },
      };
    },
  };
}

const defaults = publicLeadAbuseConfig({});
assert(defaults.maxBodyBytes === 128 * 1024, 'public lead body default must be 128KB');
assert(defaults.burstWindowSeconds === 600, 'public lead burst window default must be 10 minutes');
assert(defaults.burstLimit === 30, 'public lead burst limit default must be 30');
assert(defaults.dailyLimit === 200, 'public lead daily limit default must be 200');

const bounded = publicLeadAbuseConfig({
  INLET_PUBLIC_LEAD_MAX_BODY_BYTES: '1',
  INLET_PUBLIC_LEAD_IP_BURST_WINDOW_SECONDS: '999999',
  INLET_PUBLIC_LEAD_IP_BURST_LIMIT: '1',
  INLET_PUBLIC_LEAD_IP_DAILY_LIMIT: '999999',
});
assert(bounded.maxBodyBytes === 16 * 1024, 'body limit env must retain a safe lower bound');
assert(bounded.burstWindowSeconds === 3600, 'burst window env must retain a safe upper bound');
assert(bounded.burstLimit === 5, 'burst limit env must retain a safe lower bound');
assert(bounded.dailyLimit === 5000, 'daily limit env must retain a safe upper bound');

const rawIp = '203.0.113.77';
const hashRequest = new Request('https://pagero.kr/api/leads', {
  method: 'POST',
  headers: { 'CF-Connecting-IP': rawIp },
  body: '{}',
});
const ipHash = publicLeadRequestIpHash(hashRequest);
assert(ipHash && ipHash !== rawIp && !ipHash.includes('203.0.113'), 'request IP must be hashed before abuse lookup');

const oversizedDb = dbWithCounts();
const oversized = await evaluatePublicLeadAbuse(new Request('https://pagero.kr/api/leads', {
  method: 'POST',
  headers: { 'CF-Connecting-IP': rawIp, 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: 'x'.repeat(140 * 1024) }),
}), { DB: oversizedDb }, { requestId: 'req-large' });
assert(oversized.allowed === false && oversized.status === 413 && oversized.code === 'LEAD_PAYLOAD_TOO_LARGE', 'oversized public lead payload must be rejected');
assert(oversizedDb.calls === 0, 'oversized payload must be rejected before D1 abuse lookup');

const normalDb = dbWithCounts({ burstCount: 12, dailyCount: 50 });
const normal = await evaluatePublicLeadAbuse(hashRequest, { DB: normalDb }, { requestId: 'req-normal', nowMs: Date.parse('2026-09-02T13:00:00.000Z') });
assert(normal.allowed === true, 'normal public lead traffic must remain allowed');
assert(normalDb.calls === 1, 'normal public lead abuse check should use one aggregate D1 query');
assert(normalDb.sql.includes('FROM leads') && normalDb.sql.includes('FROM lead_blocked_submissions'), 'global abuse ceiling must count successful and already-blocked traffic');
assert(!normalDb.sql.includes(rawIp), 'raw client IP must never be interpolated into SQL');

const burst = await evaluatePublicLeadAbuse(hashRequest, { DB: dbWithCounts({ burstCount: 30, dailyCount: 30 }) }, { requestId: 'req-burst' });
assert(burst.allowed === false && burst.status === 429 && burst.reason === 'ip_burst_limit', '10-minute IP ceiling must block abusive traffic');
assert(burst.retryAfter === 600, 'burst response must expose bounded retry timing');

const daily = await evaluatePublicLeadAbuse(hashRequest, { DB: dbWithCounts({ burstCount: 2, dailyCount: 200 }) }, { requestId: 'req-daily' });
assert(daily.allowed === false && daily.status === 429 && daily.reason === 'ip_daily_limit', 'daily IP ceiling must block abusive traffic');

const response = publicLeadAbuseResponse(burst);
assert(response.status === 429, 'abuse response must keep HTTP 429');
assert(response.headers.get('Retry-After') === '600', 'abuse response must include Retry-After');
assert(response.headers.get('Access-Control-Allow-Origin') === '*', 'public lead abuse response must preserve public POST CORS');
const responsePayload = await response.json();
assert(responsePayload.code === 'LEAD_ABUSE_RATE_LIMITED' && responsePayload.retryAfter === 600, 'abuse response must expose stable API code and retry timing');

const warnings = [];
const originalWarn = console.warn;
try {
  console.warn = (...args) => warnings.push(args);
  const degraded = await evaluatePublicLeadAbuse(hashRequest, { DB: dbWithCounts({ fail: true }) }, { requestId: 'req-degraded' });
  assert(degraded.allowed === true && degraded.degraded === true, 'D1 abuse lookup failure must fail open for legitimate inquiries');
} finally {
  console.warn = originalWarn;
}
const warningText = JSON.stringify(warnings);
assert(warningText.includes('req-degraded') && warningText.includes('D1_TEMPORARY'), 'degraded guard warning must retain request ID and safe error code');
assert(!warningText.includes(rawIp) && !warningText.includes('010-9999-9999'), 'degraded guard warning must not log raw IP or raw backend error message');

const middleware = await readFile('functions/api/_middleware.js', 'utf8');
for (const token of [
  "from './_publicLeadAbuseGuard.js'",
  "request.method !== 'POST' || url.pathname !== '/api/leads'",
  'evaluatePublicLeadAbuse(request, env, { requestId: trace.requestId })',
  'return finish(publicLeadAbuseResponse(abuse))',
  'const response = await next()',
  'return finish(preserveOriginalResponse(response))',
]) {
  assert(middleware.includes(token), `API middleware abuse guard contract missing: ${token}`);
}
assert(middleware.indexOf('evaluatePublicLeadAbuse(request, env') < middleware.indexOf('submitted = await request.clone().json()'), 'abuse guard must run before JSON parsing and downstream lead work');

console.log(JSON.stringify({
  ok: true,
  checks: 24,
  feature: 'public-lead-abuse-guard',
  defaults,
}, null, 2));
