import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_ORIGIN = 'https://pagero.kr';
const PAGE_SLUG_PATTERN = /^qa-conversion-[a-z0-9-]+$/;

function normalizeOrigin(value = '') {
  const parsed = new URL(String(value || '').trim());
  if (parsed.protocol !== 'https:') throw new Error('conversion verification origin must use HTTPS');
  if (parsed.username || parsed.password) throw new Error('conversion verification origin must not include URL credentials');
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('conversion verification target must be an exact origin without path, query, or fragment');
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

export function evaluateConversionProductionGate({
  baseUrl = DEFAULT_ORIGIN,
  allowedOrigins = [DEFAULT_ORIGIN],
  pageSlug = '',
} = {}) {
  const errors = [];
  let origin = '';
  try {
    origin = normalizeOrigin(baseUrl);
  } catch (error) {
    errors.push(String(error?.message || error));
  }
  if (origin && !allowedOrigins.includes(origin)) {
    errors.push('conversion verification origin is not approved');
  }
  const safeSlug = String(pageSlug || '').trim().toLowerCase();
  if (!PAGE_SLUG_PATTERN.test(safeSlug)) {
    errors.push('conversion fixture page slug must start with qa-conversion-');
  }
  return {
    ok: errors.length === 0,
    errors,
    origin,
    pageSlug: safeSlug,
  };
}

function safeError(error = {}) {
  return {
    message: String(error?.message || error || 'unknown error').slice(0, 400),
    ...(error?.details && typeof error.details === 'object' ? { details: error.details } : {}),
  };
}

export async function runConversionProductionSafeEntry(env = process.env) {
  let allowedOrigins;
  try {
    allowedOrigins = normalizeAllowedOrigins(env.PAGERO_CONVERSION_ALLOWED_ORIGINS || '');
  } catch (error) {
    const blocked = new Error(`invalid conversion origin allowlist: ${String(error?.message || error)}`);
    blocked.details = { securityGate: 'blocked-before-network' };
    throw blocked;
  }

  const gate = evaluateConversionProductionGate({
    baseUrl: env.INLET_CONVERSION_BASE_URL || DEFAULT_ORIGIN,
    allowedOrigins,
    pageSlug: env.INLET_CONVERSION_PAGE_SLUG || '',
  });
  if (!gate.ok) {
    const error = new Error(gate.errors.join('; '));
    error.details = { securityGate: 'blocked-before-network' };
    throw error;
  }

  process.env.INLET_CONVERSION_BASE_URL = gate.origin;
  process.env.INLET_CONVERSION_PAGE_SLUG = gate.pageSlug;
  process.env.INLET_CONVERSION_ORIGIN_VERIFIED = '1';
  const module = await import('./conversion-production-check.mjs');
  return module.runConversionProductionCheck(process.env);
}

const directRun = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';

if (directRun === import.meta.url) {
  runConversionProductionSafeEntry().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      status: 'failed-live',
      error: safeError(error),
      identifiersIncluded: false,
      customerDataIncluded: false,
    }, null, 2));
    process.exitCode = 1;
  });
}
