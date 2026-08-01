import { normalizeDomainHostname } from '../src/lib/pageDomains.js';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const DEFAULT_DNS_RESOLVER = 'https://cloudflare-dns.com/dns-query';
const PROVIDER_NAME = 'cloudflare_pages';

function providerError(message, status, code, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = { code, ...details };
  return error;
}

function normalizedStatus(value = '') {
  return String(value || '').trim().toLowerCase();
}

function firstProviderError(payload = {}) {
  const error = Array.isArray(payload?.errors) ? payload.errors[0] : null;
  return {
    code: String(error?.code || ''),
    message: String(error?.message || '').trim(),
  };
}

export function cloudflarePagesDomainReadiness(env = {}) {
  const accountId = String(env.INLET_CLOUDFLARE_ACCOUNT_ID || '').trim();
  const projectName = String(env.INLET_CLOUDFLARE_PAGES_PROJECT || '').trim();
  const apiToken = String(env.INLET_CLOUDFLARE_API_TOKEN || '').trim();
  const cnameTarget = normalizeDomainHostname(env.INLET_CUSTOM_DOMAIN_CNAME_TARGET || '');
  const missing = [];
  if (!accountId) missing.push('INLET_CLOUDFLARE_ACCOUNT_ID');
  if (!projectName) missing.push('INLET_CLOUDFLARE_PAGES_PROJECT');
  if (!apiToken) missing.push('INLET_CLOUDFLARE_API_TOKEN');
  if (!cnameTarget) missing.push('INLET_CUSTOM_DOMAIN_CNAME_TARGET');
  return {
    provider: PROVIDER_NAME,
    configured: missing.length === 0,
    accountId,
    projectName,
    apiToken,
    cnameTarget,
    missing,
  };
}

async function cloudflarePagesRequest(env, pathname, options = {}, fetchImpl = globalThis.fetch) {
  const readiness = cloudflarePagesDomainReadiness(env);
  if (!readiness.configured) {
    throw providerError(
      '운영 도메인 연결 설정이 준비되지 않았습니다.',
      503,
      'DOMAIN_PROVIDER_NOT_CONFIGURED',
      { missing: readiness.missing },
    );
  }
  if (typeof fetchImpl !== 'function') {
    throw providerError('도메인 연결 서버 요청 기능을 사용할 수 없습니다.', 503, 'DOMAIN_PROVIDER_FETCH_UNAVAILABLE');
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
  let response;
  try {
    response = await fetchImpl(`${CLOUDFLARE_API_BASE}${pathname}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${readiness.apiToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller?.signal,
    });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    throw providerError(
      timedOut ? '도메인 연결 서버 응답이 지연되고 있습니다.' : '도메인 연결 서버에 접속하지 못했습니다.',
      502,
      timedOut ? 'DOMAIN_PROVIDER_TIMEOUT' : 'DOMAIN_PROVIDER_UNREACHABLE',
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (response.status === 404 && options.allowNotFound === true) return null;
  if (!response.ok || payload?.success === false) {
    const provider = firstProviderError(payload);
    throw providerError(
      provider.message || 'Cloudflare 도메인 연결 요청을 처리하지 못했습니다.',
      response.status >= 400 && response.status < 600 ? 502 : 500,
      'DOMAIN_PROVIDER_REQUEST_FAILED',
      {
        providerCode: provider.code,
        providerStatus: response.status,
      },
    );
  }
  return payload?.result || null;
}

function domainPath(readiness, hostname = '') {
  const account = encodeURIComponent(readiness.accountId);
  const project = encodeURIComponent(readiness.projectName);
  const domain = hostname ? `/${encodeURIComponent(normalizeDomainHostname(hostname))}` : '';
  return `/accounts/${account}/pages/projects/${project}/domains${domain}`;
}

export async function getCloudflarePagesDomain(env, hostname = '', fetchImpl = globalThis.fetch) {
  const readiness = cloudflarePagesDomainReadiness(env);
  return cloudflarePagesRequest(
    env,
    domainPath(readiness, hostname),
    { method: 'GET', allowNotFound: true },
    fetchImpl,
  );
}

export async function ensureCloudflarePagesDomain(env, hostname = '', fetchImpl = globalThis.fetch) {
  const readiness = cloudflarePagesDomainReadiness(env);
  const safeHostname = normalizeDomainHostname(hostname);
  const existing = await getCloudflarePagesDomain(env, safeHostname, fetchImpl);
  if (existing) return existing;
  return cloudflarePagesRequest(
    env,
    domainPath(readiness),
    {
      method: 'POST',
      body: JSON.stringify({ name: safeHostname }),
    },
    fetchImpl,
  );
}

export async function deleteCloudflarePagesDomain(env, hostname = '', fetchImpl = globalThis.fetch) {
  const readiness = cloudflarePagesDomainReadiness(env);
  const safeHostname = normalizeDomainHostname(hostname);
  if (!safeHostname) return { deleted: false, missing: true };
  const existing = await getCloudflarePagesDomain(env, safeHostname, fetchImpl);
  if (!existing) return { deleted: false, missing: true };
  await cloudflarePagesRequest(
    env,
    domainPath(readiness, safeHostname),
    { method: 'DELETE' },
    fetchImpl,
  );
  return { deleted: true, missing: false };
}

export async function inspectCustomDomainDns(env, hostname = '', fetchImpl = globalThis.fetch) {
  const safeHostname = normalizeDomainHostname(hostname);
  const target = normalizeDomainHostname(env.INLET_CUSTOM_DOMAIN_CNAME_TARGET || '');
  const checkedAt = new Date().toISOString();
  if (!target) {
    return {
      configured: false,
      type: 'CNAME',
      host: safeHostname,
      target: '',
      matched: false,
      answers: [],
      checkedAt,
      error: '',
    };
  }
  if (typeof fetchImpl !== 'function') {
    return {
      configured: true,
      type: 'CNAME',
      host: safeHostname,
      target,
      matched: false,
      answers: [],
      checkedAt,
      error: 'DNS 조회 기능을 사용할 수 없습니다.',
    };
  }

  const resolver = new URL(String(env.INLET_DNS_JSON_RESOLVER_URL || DEFAULT_DNS_RESOLVER));
  resolver.searchParams.set('name', safeHostname);
  resolver.searchParams.set('type', 'CNAME');
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;
  try {
    const response = await fetchImpl(resolver.toString(), {
      headers: { Accept: 'application/dns-json' },
      signal: controller?.signal,
    });
    if (!response.ok) throw new Error(`DNS_HTTP_${response.status}`);
    const payload = await response.json();
    const answers = (Array.isArray(payload?.Answer) ? payload.Answer : [])
      .filter((answer) => Number(answer?.type) === 5)
      .map((answer) => normalizeDomainHostname(answer?.data || ''))
      .filter(Boolean);
    return {
      configured: true,
      type: 'CNAME',
      host: safeHostname,
      target,
      matched: answers.includes(target),
      answers,
      checkedAt,
      error: '',
    };
  } catch {
    return {
      configured: true,
      type: 'CNAME',
      host: safeHostname,
      target,
      matched: false,
      answers: [],
      checkedAt,
      error: 'DNS 조회를 완료하지 못했습니다. 잠시 후 다시 확인해주세요.',
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function mapCloudflarePagesDomain(result = {}, dns = {}) {
  const providerStatus = normalizedStatus(result?.status);
  const verificationStatus = normalizedStatus(result?.verification_data?.status);
  const validationStatus = normalizedStatus(result?.validation_data?.status);
  const failedStatuses = new Set(['error', 'blocked', 'deactivated']);
  const providerFailed = failedStatuses.has(providerStatus) || failedStatuses.has(verificationStatus);
  const sslFailed = failedStatuses.has(validationStatus);
  const providerReady = providerStatus === 'active'
    && (!verificationStatus || verificationStatus === 'active');
  const sslStatus = validationStatus === 'active'
    ? 'active'
    : (sslFailed ? 'failed' : 'pending');
  const dnsReady = dns.configured === false || dns.matched === true;
  const domainStatus = providerFailed || sslFailed
    ? 'failed'
    : (providerReady && sslStatus === 'active' && dnsReady ? 'active' : 'verifying');
  const providerMessage = String(
    result?.verification_data?.error_message
      || result?.validation_data?.error_message
      || '',
  ).trim();
  const failureReason = domainStatus === 'failed'
    ? (providerMessage || '도메인 또는 SSL 확인에 실패했습니다. DNS 설정을 확인해주세요.')
    : (!dnsReady && dns?.target
      ? `CNAME 레코드가 ${dns.target}을 가리키는지 확인해주세요.`
      : '');

  return {
    provider: PROVIDER_NAME,
    providerDomainId: String(result?.domain_id || result?.id || ''),
    providerStatus,
    verificationStatus,
    validationStatus,
    validationMethod: String(result?.validation_data?.method || ''),
    validationName: String(result?.validation_data?.txt_name || ''),
    validationValue: String(result?.validation_data?.txt_value || ''),
    domainStatus,
    sslStatus,
    failureReason,
  };
}
