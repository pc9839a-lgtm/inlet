import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_ENDPOINT = 'https://pagero.kr/api/admin/data/retention';
const DEFAULT_ALLOWED_ORIGINS = ['https://pagero.kr'];
const REQUIRED_PATH = '/api/admin/data/retention';
const MIN_SECRET_LENGTH = 24;
const WRITE_APPROVAL = 'I_APPROVE_PAGERO_DATA_RETENTION';

function normalizeOrigin(value) {
  const parsed = new URL(String(value || '').trim());
  if (parsed.protocol !== 'https:') throw new Error('data retention origin must use HTTPS');
  if (parsed.username || parsed.password) throw new Error('data retention origin must not include credentials');
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('data retention allowlist entries must be origins only');
  }
  return parsed.origin;
}

export function normalizeDataRetentionAllowedOrigins(value = '') {
  const configured = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured].map(normalizeOrigin))];
}

export function normalizeDataRetentionEndpoint(value = DEFAULT_ENDPOINT) {
  const parsed = new URL(String(value || DEFAULT_ENDPOINT).trim());
  if (parsed.protocol !== 'https:') throw new Error('data retention endpoint must use HTTPS');
  if (parsed.username || parsed.password) throw new Error('data retention endpoint must not include credentials');
  if (parsed.pathname !== REQUIRED_PATH || parsed.search || parsed.hash) {
    throw new Error(`data retention endpoint must use the exact path ${REQUIRED_PATH}`);
  }
  return parsed;
}

export function evaluateDataRetentionGate({
  endpoint = DEFAULT_ENDPOINT,
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS,
  secret = '',
  writeEnabled = false,
  approval = '',
} = {}) {
  const errors = [];
  let target = null;
  try {
    target = normalizeDataRetentionEndpoint(endpoint);
  } catch (error) {
    errors.push(String(error?.message || error));
  }
  if (target && !allowedOrigins.includes(target.origin)) {
    errors.push('data retention endpoint origin is not in PAGERO_DATA_RETENTION_ALLOWED_ORIGINS');
  }
  if (String(secret || '').length < MIN_SECRET_LENGTH) {
    errors.push(`data retention secret must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  if (writeEnabled && String(approval || '') !== WRITE_APPROVAL) {
    errors.push('data retention write requires exact approval phrase');
  }
  return {
    ok: errors.length === 0,
    errors,
    targetUrl: target?.toString() || '',
    dryRun: !writeEnabled,
  };
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function main() {
  const endpoint = String(process.env.PAGERO_DATA_RETENTION_URL || DEFAULT_ENDPOINT);
  const secret = String(process.env.PAGERO_DATA_RETENTION_SECRET || '');
  const writeEnabled = String(process.env.PAGERO_DATA_RETENTION_WRITE || '') === '1';
  const approval = String(process.env.PAGERO_DATA_RETENTION_APPROVAL || '');

  let allowedOrigins;
  try {
    allowedOrigins = normalizeDataRetentionAllowedOrigins(process.env.PAGERO_DATA_RETENTION_ALLOWED_ORIGINS || '');
  } catch (error) {
    throw new Error(`invalid data retention allowlist: ${String(error?.message || error)}`);
  }

  const gate = evaluateDataRetentionGate({
    endpoint,
    allowedOrigins,
    secret,
    writeEnabled,
    approval,
  });
  if (!gate.ok) throw new Error(gate.errors.join('; '));

  const response = await fetch(gate.targetUrl, {
    method: 'POST',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Inlet-Data-Retention-Secret': secret,
    },
    body: JSON.stringify({ dryRun: gate.dryRun }),
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`data retention endpoint returned invalid JSON with status ${response.status}`);
  }

  if (!response.ok || payload.ok !== true) {
    throw new Error(`data retention endpoint failed with status ${response.status}`);
  }
  if (Boolean(payload.dryRun) !== gate.dryRun) {
    throw new Error('data retention response dry-run state mismatch');
  }
  if (gate.dryRun && safeNumber(payload.totalDeleted) !== 0) {
    throw new Error('data retention dry-run unexpectedly deleted rows');
  }

  const targetSummary = Object.fromEntries(
    Object.entries(payload.targets || {}).map(([key, value]) => [key, {
      candidates: safeNumber(value?.candidates),
      deleted: safeNumber(value?.deleted),
      remainingEstimate: safeNumber(value?.remainingEstimate),
    }]),
  );

  console.log(JSON.stringify({
    ok: true,
    status: 'verified-live',
    endpointOrigin: new URL(gate.targetUrl).origin,
    dryRun: gate.dryRun,
    policy: payload.policy || {},
    targets: targetSummary,
    totalCandidates: safeNumber(payload.totalCandidates),
    totalDeleted: safeNumber(payload.totalDeleted),
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
