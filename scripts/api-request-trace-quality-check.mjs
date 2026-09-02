import { readFile } from 'node:fs/promises';
import {
  API_REQUEST_ID_HEADER,
  API_TRACE_SLOW_MS,
  bindApiRequestTrace,
  createApiRequestTrace,
  finalizeApiRequestTrace,
  logApiRequestException,
} from '../functions/api/_requestTrace.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const middleware = await readFile('functions/api/_middleware.js', 'utf8');

const request = new Request('https://pagero.kr/api/health?email=secret@example.com&token=hidden', {
  method: 'GET',
  headers: { 'cf-ray': 'abc123-ICN' },
});
const trace = createApiRequestTrace(request, 1000);
assert(trace.requestId && trace.requestId.length >= 8, 'API trace should create a server request ID');
assert(trace.method === 'GET', 'API trace should record the method');
assert(trace.path === '/api/health', 'API trace should record pathname only');
assert(trace.edgeRay === 'abc123-ICN', 'API trace should keep the safe Cloudflare ray ID');
assert(!JSON.stringify(trace).includes('secret@example.com') && !JSON.stringify(trace).includes('hidden'), 'API trace must not retain query values');

const context = { data: {} };
bindApiRequestTrace(context, trace);
assert(context.data.pageroRequestId === trace.requestId, 'API trace should propagate the request ID through middleware context data');

const originalResponse = new Response('ok', {
  status: 200,
  headers: {
    'Set-Cookie': 'pagero_session=test; Path=/; HttpOnly',
    'Access-Control-Expose-Headers': 'ETag',
  },
});
const finalized = finalizeApiRequestTrace(originalResponse, trace, 1200);
assert(finalized.headers.get(API_REQUEST_ID_HEADER) === trace.requestId, 'API response should expose the Pagero request ID');
assert((finalized.headers.get('Access-Control-Expose-Headers') || '').includes('ETag'), 'API trace must preserve existing exposed headers');
assert((finalized.headers.get('Access-Control-Expose-Headers') || '').includes(API_REQUEST_ID_HEADER), 'API request ID should be readable by CORS clients');
assert((finalized.headers.get('Set-Cookie') || '').includes('pagero_session=test'), 'API tracing must preserve auth cookies');
assert(await finalized.text() === 'ok', 'API tracing must preserve the response body');

const errorCalls = [];
const warnCalls = [];
const originalError = console.error;
const originalWarn = console.warn;
try {
  console.error = (...args) => errorCalls.push(args);
  console.warn = (...args) => warnCalls.push(args);

  const failedTrace = createApiRequestTrace(new Request('https://pagero.kr/api/pages/demo?password=private'), 2000);
  finalizeApiRequestTrace(new Response('failed', { status: 503 }), failedTrace, 2050);
  assert(errorCalls.length === 1, '5xx API responses should emit one central error trace');
  assert(!JSON.stringify(errorCalls).includes('password') && !JSON.stringify(errorCalls).includes('private'), '5xx trace logs must not include query data');

  const slowTrace = createApiRequestTrace(new Request('https://pagero.kr/api/stats/summary'), 3000);
  finalizeApiRequestTrace(new Response('ok', { status: 200 }), slowTrace, 3000 + API_TRACE_SLOW_MS);
  assert(warnCalls.length === 1, 'slow successful API responses should emit one warning trace');

  const thrownTrace = createApiRequestTrace(new Request('https://pagero.kr/api/auth/login'), 4000);
  const secretError = new Error('login failed for private-user@example.com');
  secretError.code = 'AUTH_INTERNAL_TEST';
  logApiRequestException(thrownTrace, secretError, 4010);
  const exceptionLog = JSON.stringify(errorCalls.at(-1));
  assert(exceptionLog.includes('AUTH_INTERNAL_TEST'), 'exception trace should retain a safe error code');
  assert(!exceptionLog.includes('private-user@example.com'), 'exception trace must not include raw error messages');
} finally {
  console.error = originalError;
  console.warn = originalWarn;
}

for (const token of [
  "from './_requestTrace.js'",
  'createApiRequestTrace(request)',
  'bindApiRequestTrace(context',
  'finalizeApiRequestTrace(response, trace)',
  'logApiRequestException(trace, error)',
  'return finish(await next())',
  'requestId: trace.requestId',
]) {
  assert(middleware.includes(token), `API middleware request trace contract missing ${token}`);
}

assert(!middleware.includes("message: String(error?.message"), 'API middleware should not log raw exception messages');

console.log(JSON.stringify({
  ok: true,
  check: 'api-request-trace',
  header: API_REQUEST_ID_HEADER,
  slowMs: API_TRACE_SLOW_MS,
  privacy: 'pathname-only-no-raw-error-message',
}, null, 2));
