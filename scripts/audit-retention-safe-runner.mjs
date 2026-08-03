import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_ENDPOINT = 'https://pagero.kr/api/admin/audit/retention';
const DEFAULT_ALLOWED_ORIGINS = ['https://pagero.kr'];
const REQUIRED_PATH = '/api/admin/audit/retention';
const MIN_SECRET_LENGTH = 24;

function normalizeOrigin(value) {
  const parsed = new URL(String(value || '').trim());
  if (parsed.protocol !== 'https:') throw new Error('retention origin must use HTTPS');
  if (parsed.username || parsed.password) throw new Error('retention origin must not include credentials');
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('retention allowlist entries must be origins only');
  }
  return parsed.origin;
}

export function normalizeRetentionAllowedOrigins(value = '') {
  const configured = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured].map(normalizeOrigin))];
}

export function normalizeRetentionEndpoint(value = DEFAULT_ENDPOINT) {
  const parsed = new URL(String(value || DEFAULT_ENDPOINT).trim());
  if (parsed.protocol !== 'https:') throw new Error('retention endpoint must use HTTPS');
  if (parsed.username || parsed.password) throw new Error('retention endpoint must not include credentials');
  if (parsed.pathname !== REQUIRED_PATH || parsed.search || parsed.hash) {
    throw new Error(`retention endpoint must use the exact path ${REQUIRED_PATH}`);
  }
  return parsed;
}

export function evaluateRetentionGate({ endpoint = DEFAULT_ENDPOINT, allowedOrigins = DEFAULT_ALLOWED_ORIGINS, secret = '' } = {}) {
  const errors = [];
  let target = null;
  try {
    target = normalizeRetentionEndpoint(endpoint);
  } catch (error) {
    errors.push(String(error?.message || error));
  }
  if (target && !allowedOrigins.includes(target.origin)) {
    errors.push('retention endpoint origin is not in PAGERO_AUDIT_RETENTION_ALLOWED_ORIGINS');
  }
  if (String(secret || '').length < MIN_SECRET_LENGTH) {
    errors.push(`retention secret must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return { ok: errors.length === 0, errors, targetUrl: target?.toString() || '' };
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function main() {
  const endpoint = String(process.env.PAGERO_AUDIT_RETENTION_URL || DEFAULT_ENDPOINT);
  const secret = String(process.env.PAGERO_AUDIT_RETENTION_SECRET || '');
  const dryRun = String(process.env.PAGERO_AUDIT_RETENTION_DRY_RUN || '').toLowerCase() === 'true';

  let allowedOrigins;
  try {
    allowedOrigins = normalizeRetentionAllowedOrigins(process.env.PAGERO_AUDIT_RETENTION_ALLOWED_ORIGINS || '');
  } catch (error) {
    throw new Error(`invalid retention allowlist: ${String(error?.message || error)}`);
  }

  const gate = evaluateRetentionGate({ endpoint, allowedOrigins, secret });
  if (!gate.ok) throw new Error(gate.errors.join('; '));

  const response = await fetch(gate.targetUrl, {
    method: 'POST',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Inlet-Audit-Retention-Secret': secret,
    },
    body: JSON.stringify(dryRun ? { dryRun: true } : {}),
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`retention endpoint returned invalid JSON with status ${response.status}`);
  }

  if (!response.ok || payload.ok !== true) {
    throw new Error(`retention endpoint failed with status ${response.status}`);
  }
  if (Boolean(payload.dryRun) !== dryRun) throw new Error('retention response dry-run state mismatch');
  if (dryRun && safeNumber(payload.deleted) !== 0) throw new Error('retention dry-run unexpectedly deleted rows');

  console.log(JSON.stringify({
    ok: true,
    status: 'verified-live',
    endpointOrigin: new URL(gate.targetUrl).origin,
    dryRun,
    cutoff: String(payload.cutoff || ''),
    retentionDays: safeNumber(payload.retentionDays),
    batchLimit: safeNumber(payload.batchLimit),
    candidates: safeNumber(payload.candidates),
    deleted: safeNumber(payload.deleted),
    remainingEstimate: safeNumber(payload.remainingEstimate),
    secretValuesIncluded: false,
  }, null, 2));
}

const invoked = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';

if (invoked === import.meta.url) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      status: 'failed-live',
      error: String(error?.message || error).slice(0, 500),
      secretValuesIncluded: false,
    }, null, 2));
    process.exitCode = 1;
  });
}
