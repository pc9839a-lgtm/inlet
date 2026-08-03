import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_ORIGIN = 'https://pagero.kr';
const REQUIRED_PATH = '/api/admin/domains/recheck';
const MIN_SECRET_LENGTH = 32;
const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeOrigin(value = '') {
  const parsed = new URL(String(value || '').trim());
  if (parsed.protocol !== 'https:') throw new Error('domain recheck origin must use HTTPS');
  if (parsed.username || parsed.password) throw new Error('domain recheck origin must not include URL credentials');
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('allowed domain recheck entries must be exact origins without path, query, or fragment');
  }
  return parsed.origin;
}

export function normalizeAllowedOrigins(value = '') {
  const configured = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([DEFAULT_ORIGIN, ...configured].map(normalizeOrigin))];
}

export function validateDomainRecheckTarget(value = '', allowedOrigins = [DEFAULT_ORIGIN]) {
  const parsed = new URL(String(value || `${DEFAULT_ORIGIN}${REQUIRED_PATH}`).trim());
  const errors = [];
  if (parsed.protocol !== 'https:') errors.push('domain recheck endpoint must use HTTPS');
  if (parsed.username || parsed.password) errors.push('domain recheck endpoint must not include URL credentials');
  if (parsed.pathname !== REQUIRED_PATH) errors.push(`domain recheck endpoint path must be exactly ${REQUIRED_PATH}`);
  if (parsed.search || parsed.hash) errors.push('domain recheck endpoint must not include query or fragment');
  if (!allowedOrigins.includes(parsed.origin)) errors.push('domain recheck endpoint origin is not approved');
  return {
    ok: errors.length === 0,
    endpoint: errors.length === 0 ? `${parsed.origin}${REQUIRED_PATH}` : '',
    origin: parsed.origin,
    errors,
  };
}

export function validateDomainRecheckSecret(value = '') {
  const secret = String(value || '').trim();
  const errors = [];
  if (!secret) errors.push('PAGERO_DOMAIN_RECHECK_SECRET is required');
  if (secret && secret.length < MIN_SECRET_LENGTH) {
    errors.push(`PAGERO_DOMAIN_RECHECK_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return { ok: errors.length === 0, secret, errors };
}

function boundedTimeout(value = DEFAULT_TIMEOUT_MS) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.max(5_000, Math.min(60_000, parsed));
}

function safeFailure(error = {}) {
  return {
    message: String(error?.message || error || 'unknown error').slice(0, 300),
    code: String(error?.code || '').slice(0, 100),
  };
}

export async function executeDomainRecheck({
  endpoint,
  secret,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('global fetch is unavailable');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), boundedTimeout(timeoutMs));
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      throw new Error(`domain recheck returned non-JSON response (${response.status})`);
    }
    if (!response.ok || payload?.ok !== true) {
      const error = new Error(`domain recheck failed with HTTP ${response.status}`);
      error.code = String(payload?.code || payload?.details?.code || 'DOMAIN_RECHECK_HTTP_FAILED');
      throw error;
    }
    return {
      ok: true,
      status: 'verified-live',
      endpointOrigin: new URL(endpoint).origin,
      processed: Number(payload.processed || 0),
      succeeded: Number(payload.succeeded || 0),
      failed: Number(payload.failed || 0),
      operatorRequired: Number(payload.operatorRequired || 0),
      secretValuesIncluded: false,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('domain recheck request timed out');
      timeoutError.code = 'DOMAIN_RECHECK_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  let allowedOrigins;
  try {
    allowedOrigins = normalizeAllowedOrigins(process.env.PAGERO_DOMAIN_RECHECK_ALLOWED_ORIGINS || '');
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      status: 'failed-live',
      error: safeFailure(error),
      secretValuesIncluded: false,
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const target = validateDomainRecheckTarget(
    process.env.PAGERO_DOMAIN_RECHECK_URL || `${DEFAULT_ORIGIN}${REQUIRED_PATH}`,
    allowedOrigins,
  );
  const secret = validateDomainRecheckSecret(process.env.PAGERO_DOMAIN_RECHECK_SECRET || '');
  if (!target.ok || !secret.ok) {
    console.error(JSON.stringify({
      ok: false,
      status: 'failed-live',
      targetOrigin: target.origin || null,
      errors: [...target.errors, ...secret.errors],
      secretValuesIncluded: false,
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  try {
    const result = await executeDomainRecheck({
      endpoint: target.endpoint,
      secret: secret.secret,
      timeoutMs: process.env.PAGERO_DOMAIN_RECHECK_TIMEOUT_MS,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      status: 'failed-live',
      endpointOrigin: target.origin,
      error: safeFailure(error),
      secretValuesIncluded: false,
    }, null, 2));
    process.exitCode = 1;
  }
}

const invoked = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';

if (invoked === import.meta.url) {
  await main();
}
