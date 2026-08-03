import { pathToFileURL } from 'node:url';

const DEFAULT_ALLOWED_ORIGINS = ['https://pagero.kr'];
const WRITE_APPROVAL = 'I_APPROVE_GOOGLE_SHEETS_LIVE_WRITES';
const ALLOWED_PHASES = new Set(['read-only', 'verify-live']);

function normalizeOrigin(value) {
  const parsed = new URL(String(value || '').trim());
  if (parsed.protocol !== 'https:') throw new Error('Pagero verification origin must use HTTPS');
  if (parsed.username || parsed.password) throw new Error('Pagero verification origin must not include credentials');
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Pagero verification target must be an origin without path, query, or fragment');
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

export function evaluateGoogleSheetsLiveGate({
  baseUrl = 'https://pagero.kr',
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS,
  phase = 'read-only',
  allowWrites = false,
  approval = '',
  pageSlug = '',
  sheetName = '',
} = {}) {
  const errors = [];
  let origin = '';

  try {
    origin = normalizeOrigin(baseUrl);
  } catch (error) {
    errors.push(String(error?.message || error));
  }

  if (origin && !allowedOrigins.includes(origin)) {
    errors.push('Pagero verification origin is not in PAGERO_GOOGLE_SHEETS_ALLOWED_ORIGINS');
  }
  if (!ALLOWED_PHASES.has(phase)) errors.push('unsupported Google Sheets verification phase');
  if (pageSlug && !/^qa-sheets-[a-z0-9-]+$/.test(pageSlug)) {
    errors.push('fixture page slug must start with qa-sheets-');
  }
  if (sheetName && !/^qa(?:[- _]|$)/i.test(sheetName)) {
    errors.push('fixture sheet name must start with QA');
  }
  if (phase === 'verify-live') {
    if (!allowWrites) errors.push('verify-live requires allow_writes=true');
    if (approval !== WRITE_APPROVAL) errors.push(`verify-live requires approval phrase ${WRITE_APPROVAL}`);
  }

  return { ok: errors.length === 0, errors, origin, phase, writeApproved: phase !== 'verify-live' || (allowWrites && approval === WRITE_APPROVAL) };
}

export async function runGoogleSheetsSafeEntry(env = process.env) {
  let allowedOrigins;
  try {
    allowedOrigins = normalizeAllowedOrigins(env.PAGERO_GOOGLE_SHEETS_ALLOWED_ORIGINS || '');
  } catch (error) {
    throw new Error(`invalid Pagero origin allowlist: ${String(error?.message || error)}`);
  }

  const phase = String(env.INLET_GOOGLE_SHEETS_LIVE_PHASE || 'read-only').trim().toLowerCase();
  const gate = evaluateGoogleSheetsLiveGate({
    baseUrl: env.INLET_GOOGLE_SHEETS_BASE_URL || 'https://pagero.kr',
    allowedOrigins,
    phase,
    allowWrites: String(env.INLET_GOOGLE_SHEETS_LIVE_WRITE || '') === '1',
    approval: String(env.INLET_GOOGLE_SHEETS_LIVE_APPROVAL || ''),
    pageSlug: String(env.INLET_GOOGLE_SHEETS_PAGE_SLUG || '').trim().toLowerCase(),
    sheetName: String(env.INLET_GOOGLE_SHEETS_SHEET_NAME || '').trim(),
  });

  if (!gate.ok) {
    const error = new Error(gate.errors.join('; '));
    error.details = { phase, securityGate: 'blocked-before-secrets-or-network' };
    throw error;
  }

  process.env.INLET_GOOGLE_SHEETS_BASE_URL = gate.origin;
  process.env.INLET_GOOGLE_SHEETS_LIVE_PHASE = phase;
  process.env.INLET_GOOGLE_SHEETS_ORIGIN_VERIFIED = '1';
  await import('./google-sheets-production-check.mjs');
}

function safeError(error) {
  return {
    message: String(error?.message || error || 'unknown error').slice(0, 500),
    ...(error?.details && typeof error.details === 'object' ? { details: error.details } : {}),
  };
}

const directRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (directRun) {
  runGoogleSheetsSafeEntry().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      status: 'failed-live',
      phase: String(process.env.INLET_GOOGLE_SHEETS_LIVE_PHASE || 'read-only'),
      error: safeError(error),
      secretValuesIncluded: false,
    }, null, 2));
    process.exitCode = 1;
  });
}
