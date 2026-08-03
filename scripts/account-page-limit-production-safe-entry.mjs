import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_ALLOWED_ORIGINS = ['https://pagero.kr'];
const APPROVAL_PHRASE = 'I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES';

function normalizeOrigin(value) {
  const parsed = new URL(String(value || '').trim());
  if (parsed.protocol !== 'https:') throw new Error('target origin must use HTTPS');
  if (parsed.username || parsed.password) throw new Error('target origin must not include credentials');
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('target must be an origin only, without path, query, or fragment');
  }
  return parsed.origin;
}

export function normalizeAllowedOrigins(value = '') {
  const configured = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured].map(normalizeOrigin))];
}

export function evaluateLaunchGate({
  baseUrl = '',
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS,
  writeEnabled = false,
  approval = '',
} = {}) {
  const errors = [];
  let targetOrigin = '';
  try {
    targetOrigin = normalizeOrigin(baseUrl);
  } catch (error) {
    errors.push(String(error?.message || error));
  }
  if (targetOrigin && !allowedOrigins.includes(targetOrigin)) {
    errors.push('target origin is not in PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS');
  }
  if (!writeEnabled) errors.push('live write verification requires INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE=1');
  if (approval !== APPROVAL_PHRASE) {
    errors.push(`live write verification requires approval phrase ${APPROVAL_PHRASE}`);
  }
  return { ok: errors.length === 0, errors, targetOrigin };
}

export function createOriginLockedFetch(targetOrigin, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('global fetch is unavailable');
  return async function originLockedFetch(input, init = {}) {
    const rawUrl = input instanceof URL
      ? input.href
      : typeof input === 'string'
        ? input
        : input?.url;
    const requestUrl = new URL(String(rawUrl || ''));
    if (requestUrl.origin !== targetOrigin) {
      throw new Error('cross-origin request blocked before signed session transmission');
    }
    return fetchImpl(input, {
      ...init,
      redirect: 'error',
    });
  };
}

function printResult(result, error = false) {
  const output = `${JSON.stringify({ ...result, secretValuesIncluded: false }, null, 2)}\n`;
  if (error) process.stderr.write(output);
  else process.stdout.write(output);
}

async function main() {
  const requireLive = process.env.INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE === '1';
  const writeEnabled = process.env.INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE === '1';
  const approval = String(process.env.INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL || '');
  const baseUrl = String(process.env.INLET_ACCOUNT_PAGE_LIMIT_BASE_URL || 'https://pagero.kr');

  let allowedOrigins;
  try {
    allowedOrigins = normalizeAllowedOrigins(process.env.PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS || '');
  } catch (error) {
    printResult({
      ok: false,
      status: 'failed-live',
      reason: `invalid allowed-origin configuration: ${String(error?.message || error)}`,
    }, true);
    process.exitCode = 1;
    return;
  }

  const gate = evaluateLaunchGate({ baseUrl, allowedOrigins, writeEnabled, approval });
  if (!gate.ok) {
    const securityFailure = gate.errors.some((message) => (
      message.includes('HTTPS')
      || message.includes('credentials')
      || message.includes('origin only')
      || message.includes('not in PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS')
    ));
    const status = securityFailure ? 'failed-live' : 'skipped-live';
    printResult({
      ok: securityFailure ? false : !requireLive,
      status,
      targetOrigin: gate.targetOrigin || null,
      writeEnabled,
      errors: gate.errors,
    }, securityFailure || requireLive);
    if (securityFailure || requireLive) process.exitCode = 1;
    return;
  }

  process.env.INLET_ACCOUNT_PAGE_LIMIT_BASE_URL = gate.targetOrigin;
  globalThis.fetch = createOriginLockedFetch(gate.targetOrigin, globalThis.fetch);

  const checker = path.join(process.cwd(), 'scripts', 'account-page-limit-production-check.mjs');
  await import(pathToFileURL(checker).href);
}

const invoked = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';

if (invoked === import.meta.url) {
  main().catch((error) => {
    printResult({
      ok: false,
      status: 'failed-live',
      error: String(error?.message || error).slice(0, 500),
    }, true);
    process.exitCode = 1;
  });
}
