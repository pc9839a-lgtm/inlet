import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const API_ROOT = 'https://api.cloudflare.com/client/v4';
const ROOT = process.cwd();
const OUTPUT_DIR_NAME = '.tmp-d1-migration-safety';

function stripJsonComments(source = '') {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function redact(value = '') {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
    .replace(/(?:token|secret|password|authorization)(["'\s:=]+)[^\s,"'}]+/gi, '$1[redacted]')
    .slice(0, 2000);
}

function normalizeErrors(payload = {}) {
  const rows = Array.isArray(payload?.errors) ? payload.errors : [];
  return rows.slice(0, 10).map((item) => ({
    code: Number.isFinite(Number(item?.code)) ? Number(item.code) : null,
    message: redact(item?.message || ''),
  }));
}

function outputDir() {
  const requested = String(process.env.INLET_D1_MIGRATION_OUTPUT_DIR || OUTPUT_DIR_NAME).trim();
  const resolved = path.resolve(ROOT, requested);
  const relative = path.relative(ROOT, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('D1 migration output directory must remain inside the repository workspace');
  }
  return resolved;
}

async function writeEvidence(value) {
  const output = outputDir();
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, 'd1-cloudflare-access-preflight.json'),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
}

export function resolveD1Target({ env = {}, config = {} } = {}) {
  const database = Array.isArray(config?.d1_databases) ? config.d1_databases[0] : null;
  const declaredName = String(database?.database_name || '').trim();
  const declaredId = String(database?.database_id || '').trim();
  const overrideName = String(env.PAGERO_D1_DATABASE_NAME || env.INLET_D1_DATABASE_NAME || '').trim();
  const overrideId = String(env.PAGERO_D1_DATABASE_ID || env.INLET_D1_DATABASE_ID || '').trim();
  const mismatches = [];

  if (overrideName && declaredName && overrideName !== declaredName) {
    mismatches.push('PAGERO_D1_DATABASE_NAME does not match wrangler.jsonc database_name');
  }
  if (overrideId && declaredId && overrideId !== declaredId) {
    mismatches.push('PAGERO_D1_DATABASE_ID does not match wrangler.jsonc database_id');
  }

  return {
    ok: mismatches.length === 0,
    errors: mismatches,
    databaseName: overrideName || declaredName,
    databaseId: overrideId || declaredId,
    binding: String(database?.binding || 'DB').trim(),
    nameSource: overrideName ? 'environment' : declaredName ? 'wrangler.jsonc' : 'missing',
    idSource: overrideId ? 'environment' : declaredId ? 'wrangler.jsonc' : 'missing',
  };
}

async function cloudflareRequest(pathname, apiToken) {
  const response = await fetch(`${API_ROOT}${pathname}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiToken}` },
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok && payload?.success !== false,
    status: response.status,
    payload,
    errors: normalizeErrors(payload),
  };
}

export function classifyD1AccessFailure({ status = 0, errors = [] } = {}) {
  const codes = errors.map((item) => Number(item?.code)).filter(Number.isFinite);
  if (status === 403 && codes.includes(7403)) {
    return {
      code: 'CLOUDFLARE_D1_ACCOUNT_OR_PERMISSION_MISMATCH',
      message: 'Cloudflare token is active, but the selected account cannot access this D1 database. Check that CLOUDFLARE_ACCOUNT_ID owns the configured database_id and that the token is scoped to that account with D1 Read permission.',
    };
  }
  if (status === 401 || status === 403) {
    return {
      code: 'CLOUDFLARE_D1_PERMISSION_DENIED',
      message: 'Cloudflare token cannot read the configured D1 database. Check account scope and D1 Read permission.',
    };
  }
  if (status === 404) {
    return {
      code: 'CLOUDFLARE_D1_DATABASE_NOT_FOUND',
      message: 'The configured D1 database_id was not found under the selected Cloudflare account.',
    };
  }
  return {
    code: 'CLOUDFLARE_D1_ACCESS_CHECK_FAILED',
    message: 'Cloudflare D1 access check failed before migration inspection.',
  };
}

export async function verifyCloudflareD1Access({ accountId = '', apiToken = '', databaseId = '', databaseName = '' } = {}) {
  const result = {
    ok: false,
    stage: 'token-verify',
    token: { active: false, status: 'unknown' },
    accountIdSuffix: String(accountId || '').slice(-6),
    d1: {
      accessible: false,
      databaseName: String(databaseName || ''),
      databaseIdSuffix: String(databaseId || '').slice(-8),
    },
    error: null,
    secretValuesIncluded: false,
  };

  const tokenCheck = await cloudflareRequest('/user/tokens/verify', apiToken);
  const tokenStatus = String(tokenCheck?.payload?.result?.status || '').toLowerCase();
  result.token.status = tokenStatus || 'unknown';
  result.token.active = tokenCheck.ok && tokenStatus === 'active';
  if (!result.token.active) {
    result.error = {
      code: 'CLOUDFLARE_API_TOKEN_INVALID',
      message: tokenStatus && tokenStatus !== 'active'
        ? `Cloudflare API token is ${tokenStatus}.`
        : 'Cloudflare API token verification failed.',
      httpStatus: tokenCheck.status,
      providerErrors: tokenCheck.errors,
    };
    return result;
  }

  result.stage = 'd1-database-access';
  const databaseCheck = await cloudflareRequest(
    `/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}`,
    apiToken,
  );
  if (!databaseCheck.ok) {
    const classified = classifyD1AccessFailure(databaseCheck);
    result.error = {
      ...classified,
      httpStatus: databaseCheck.status,
      providerErrors: databaseCheck.errors,
    };
    return result;
  }

  const providerName = String(databaseCheck?.payload?.result?.name || '').trim();
  const providerUuid = String(databaseCheck?.payload?.result?.uuid || databaseCheck?.payload?.result?.id || '').trim();
  if (providerUuid && providerUuid !== databaseId) {
    result.error = {
      code: 'CLOUDFLARE_D1_DATABASE_ID_MISMATCH',
      message: 'Cloudflare returned a different D1 database identifier than the configured database_id.',
      httpStatus: databaseCheck.status,
      providerErrors: [],
    };
    return result;
  }
  if (providerName && databaseName && providerName !== databaseName) {
    result.error = {
      code: 'CLOUDFLARE_D1_DATABASE_NAME_MISMATCH',
      message: 'Cloudflare returned a different D1 database name than the configured database_name.',
      httpStatus: databaseCheck.status,
      providerErrors: [],
    };
    return result;
  }

  result.ok = true;
  result.stage = 'verified';
  result.d1.accessible = true;
  result.d1.databaseName = providerName || String(databaseName || '');
  return result;
}

export async function runCloudflareAccessPreflight(env = process.env) {
  const raw = await readFile(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
  const config = JSON.parse(stripJsonComments(raw));
  const target = resolveD1Target({ env, config });
  const requireLive = env.INLET_D1_MIGRATION_REQUIRE_LIVE === '1';
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(env.CLOUDFLARE_API_TOKEN || '').trim();

  const base = {
    ok: false,
    status: 'failed-live',
    stage: 'configuration',
    databaseName: target.databaseName,
    databaseBinding: target.binding,
    databaseIdSuffix: target.databaseId.slice(-8),
    databaseNameSource: target.nameSource,
    databaseIdSource: target.idSource,
    accountIdSuffix: accountId.slice(-6),
    secretValuesIncluded: false,
  };

  if (!target.ok) {
    const result = { ...base, error: { code: 'D1_CONFIG_OVERRIDE_MISMATCH', message: target.errors.join('; ') } };
    await writeEvidence(result);
    return result;
  }

  if (!accountId || !apiToken || !target.databaseId || !target.databaseName) {
    const result = {
      ...base,
      ok: !requireLive,
      status: 'skipped-live',
      error: {
        code: 'D1_LIVE_CONFIGURATION_MISSING',
        message: 'Cloudflare account/token or D1 target configuration is missing.',
      },
    };
    await writeEvidence(result);
    return result;
  }

  const access = await verifyCloudflareD1Access({
    accountId,
    apiToken,
    databaseId: target.databaseId,
    databaseName: target.databaseName,
  });
  const result = {
    ...base,
    ...access,
    status: access.ok ? 'verified-live' : 'failed-live',
    databaseNameSource: target.nameSource,
    databaseIdSource: target.idSource,
  };
  await writeEvidence(result);
  return result;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invoked === import.meta.url) {
  runCloudflareAccessPreflight().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }).catch(async (error) => {
    const failure = {
      ok: false,
      status: 'failed-live',
      stage: 'cloudflare-access-preflight',
      error: { code: 'D1_ACCESS_PREFLIGHT_CRASHED', message: redact(error?.message || error) },
      secretValuesIncluded: false,
    };
    await writeEvidence(failure).catch(() => {});
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  });
}
