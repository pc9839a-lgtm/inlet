import { pathToFileURL } from 'node:url';

const API_ROOT = 'https://api.cloudflare.com/client/v4';

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

async function cloudflareRequest(pathname, apiToken, options = {}) {
  const response = await fetch(`${API_ROOT}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
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
    d1: { accessible: false, databaseName: String(databaseName || ''), databaseIdSuffix: String(databaseId || '').slice(-8) },
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

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (invoked === import.meta.url) {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const databaseId = String(process.env.PAGERO_D1_DATABASE_ID || '').trim();
  const databaseName = String(process.env.PAGERO_D1_DATABASE_NAME || '').trim();
  const output = await verifyCloudflareD1Access({ accountId, apiToken, databaseId, databaseName });
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exitCode = 1;
}
