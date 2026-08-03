import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_ALLOWED_ORIGINS = ['https://pagero.kr'];
const ALLOWED_PHASES = new Set(['read-only', 'request-email-token', 'verify-live']);
const WRITE_PHASES = new Set(['request-email-token', 'verify-live']);
const APPROVAL_PHRASE = 'I_APPROVE_ADMIN_AUDIT_LIVE_WRITES';

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

export function evaluateAdminAuditLaunchGate({
  baseUrl = '',
  phase = 'read-only',
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS,
  writeEnabled = false,
  approval = '',
} = {}) {
  const errors = [];
  let targetOrigin = '';
  const normalizedPhase = String(phase || '').trim().toLowerCase();

  try {
    targetOrigin = normalizeOrigin(baseUrl);
  } catch (error) {
    errors.push(String(error?.message || error));
  }

  if (targetOrigin && !allowedOrigins.includes(targetOrigin)) {
    errors.push('target origin is not in PAGERO_ADMIN_AUDIT_ALLOWED_ORIGINS');
  }
  if (!ALLOWED_PHASES.has(normalizedPhase)) errors.push('unsupported admin audit verification phase');
  if (WRITE_PHASES.has(normalizedPhase)) {
    if (!writeEnabled) errors.push('write phase requires INLET_ADMIN_AUDIT_LIVE_WRITE=1');
    if (approval !== APPROVAL_PHRASE) {
      errors.push(`write phase requires approval phrase ${APPROVAL_PHRASE}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    targetOrigin,
    phase: normalizedPhase,
    writePhase: WRITE_PHASES.has(normalizedPhase),
  };
}

export function installSameOriginFetchGuard(targetOrigin) {
  const nativeFetch = globalThis.fetch?.bind(globalThis);
  if (!nativeFetch) throw new Error('global fetch is unavailable');

  globalThis.fetch = async (input, init = {}) => {
    const rawUrl = input instanceof Request ? input.url : String(input || '');
    const url = new URL(rawUrl, targetOrigin);
    if (url.origin !== targetOrigin) {
      throw new Error('cross-origin admin audit verification request blocked');
    }
    if (init.redirect && init.redirect !== 'error') {
      throw new Error('admin audit verification redirects must remain disabled');
    }
    return nativeFetch(input, { ...init, redirect: 'error' });
  };
}

function printResult(result, error = false) {
  const output = `${JSON.stringify({ ...result, secretValuesIncluded: false }, null, 2)}\n`;
  if (error) process.stderr.write(output);
  else process.stdout.write(output);
}

async function main() {
  const requireLive = process.env.INLET_ADMIN_AUDIT_LIVE_REQUIRE === '1';
  const baseUrl = String(process.env.INLET_ADMIN_AUDIT_BASE_URL || 'https://pagero.kr');
  const phase = String(process.env.INLET_ADMIN_AUDIT_LIVE_PHASE || 'read-only');
  const writeEnabled = process.env.INLET_ADMIN_AUDIT_LIVE_WRITE === '1';
  const approval = String(process.env.INLET_ADMIN_AUDIT_LIVE_APPROVAL || '');

  let allowedOrigins;
  try {
    allowedOrigins = normalizeAllowedOrigins(process.env.PAGERO_ADMIN_AUDIT_ALLOWED_ORIGINS || '');
  } catch (error) {
    printResult({
      ok: false,
      status: 'failed-live',
      reason: `invalid allowed-origin configuration: ${String(error?.message || error)}`,
    }, true);
    process.exitCode = 1;
    return;
  }

  const gate = evaluateAdminAuditLaunchGate({
    baseUrl,
    phase,
    allowedOrigins,
    writeEnabled,
    approval,
  });

  if (!gate.ok) {
    const securityFailure = gate.errors.some((message) => (
      message.includes('HTTPS')
      || message.includes('credentials')
      || message.includes('origin only')
      || message.includes('not in PAGERO_ADMIN_AUDIT_ALLOWED_ORIGINS')
      || message.includes('unsupported')
    ));
    const status = securityFailure ? 'failed-live' : 'skipped-live';
    printResult({
      ok: securityFailure ? false : !requireLive,
      status,
      targetOrigin: gate.targetOrigin || null,
      phase: gate.phase,
      writeEnabled,
      errors: gate.errors,
    }, securityFailure || requireLive);
    if (securityFailure || requireLive) process.exitCode = 1;
    return;
  }

  process.env.INLET_ADMIN_AUDIT_BASE_URL = gate.targetOrigin;
  process.env.INLET_ADMIN_AUDIT_LIVE_PHASE = gate.phase;
  installSameOriginFetchGuard(gate.targetOrigin);
  await import('./admin-audit-production-check.mjs');
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
