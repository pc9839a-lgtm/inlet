import {
  cloudflarePagesDomainReadiness,
  ensureCloudflarePagesDomain,
  inspectCustomDomainDns,
  mapCloudflarePagesDomain,
} from './cloudflarePagesDomains.mjs';
import {
  nextPageDomainRetryAt,
  publicDomainRecord,
  updateD1PageDomainOperationState,
  updateD1PageDomainVerification,
} from './pageDomainStore.mjs';

const DEFAULT_MAX_RETRIES = 8;
const ESCALATE_AFTER_RETRIES = 6;
const ESCALATE_AFTER_HOURS = 24;
const PROVIDER_NOT_CONFIGURED_RETRY_MINUTES = 360;

function safeInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function asDate(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

function isoAfterMinutes(now, minutes) {
  return new Date(asDate(now).getTime() + (Number(minutes || 0) * 60_000)).toISOString();
}

function recordAgeHours(record = {}, now = new Date()) {
  const origin = record.created_at || record.updated_at || record.last_checked_at || '';
  const originDate = asDate(origin, now);
  return Math.max(0, (asDate(now).getTime() - originDate.getTime()) / 3_600_000);
}

export function pageDomainMaxRetries(env = {}) {
  return safeInteger(env.INLET_DOMAIN_RECHECK_MAX_RETRIES, DEFAULT_MAX_RETRIES, 1, 20);
}

export function classifyPageDomainProviderError(error = {}) {
  const code = String(error?.code || error?.details?.code || 'DOMAIN_PROVIDER_UNKNOWN').trim();
  const providerStatus = Number(error?.details?.providerStatus || 0);
  const retryable = ['DOMAIN_PROVIDER_TIMEOUT', 'DOMAIN_PROVIDER_UNREACHABLE'].includes(code)
    || (code === 'DOMAIN_PROVIDER_REQUEST_FAILED' && (
      providerStatus === 0
      || providerStatus === 408
      || providerStatus === 409
      || providerStatus === 425
      || providerStatus === 429
      || providerStatus >= 500
    ));
  return { code, providerStatus, retryable };
}

export function pageDomainRetryDecision(record = {}, outcome = {}, now = new Date()) {
  const maxRetries = safeInteger(outcome.maxRetries, DEFAULT_MAX_RETRIES, 1, 20);
  if (outcome.active === true) {
    return {
      retryCount: 0,
      nextRetryAt: '',
      escalated: false,
      terminal: true,
    };
  }

  const retryCount = Number(record.retry_count || 0) + 1;
  const retryable = outcome.retryable !== false;
  const exhausted = retryCount >= maxRetries;
  const failed = outcome.failed === true;
  const escalated = failed
    || !retryable
    || exhausted
    || retryCount >= ESCALATE_AFTER_RETRIES
    || recordAgeHours(record, now) >= ESCALATE_AFTER_HOURS;
  const terminal = !retryable || exhausted;

  return {
    retryCount,
    nextRetryAt: terminal ? '' : nextPageDomainRetryAt(retryCount, now),
    escalated,
    terminal,
  };
}

export async function verifyPageDomainConnection({
  db,
  env = {},
  pageId = '',
  record = {},
  fetchImpl = globalThis.fetch,
  source = 'manual',
} = {}) {
  const readiness = cloudflarePagesDomainReadiness(env);
  const dns = await inspectCustomDomainDns(env, record.hostname || '', fetchImpl);
  const checkedAt = dns.checkedAt || new Date().toISOString();

  if (!readiness.configured) {
    await updateD1PageDomainVerification(db, pageId, {
      domainStatus: 'pending',
      sslStatus: 'pending',
      failureReason: '',
      provider: 'cloudflare_pages',
      providerStatus: 'not_configured',
      checkedAt,
    });
    const current = await updateD1PageDomainOperationState(db, pageId, {
      lastErrorCode: 'DOMAIN_PROVIDER_NOT_CONFIGURED',
      lastAttemptAt: checkedAt,
      nextRetryAt: isoAfterMinutes(checkedAt, PROVIDER_NOT_CONFIGURED_RETRY_MINUTES),
      escalate: true,
    });
    return {
      ok: true,
      action: 'verify',
      source,
      providerConfigured: false,
      operatorRequired: true,
      message: '운영 도메인 연결 설정이 준비 중입니다.',
      current: publicDomainRecord(current),
      dns,
    };
  }

  try {
    const providerResult = await ensureCloudflarePagesDomain(env, record.hostname || '', fetchImpl);
    const mapped = mapCloudflarePagesDomain(providerResult, dns);
    const verified = await updateD1PageDomainVerification(db, pageId, {
      ...mapped,
      checkedAt,
      providerSyncedAt: new Date().toISOString(),
    });

    const decision = pageDomainRetryDecision(verified, {
      active: mapped.domainStatus === 'active',
      failed: mapped.domainStatus === 'failed',
      retryable: true,
      maxRetries: pageDomainMaxRetries(env),
    }, checkedAt);
    const current = await updateD1PageDomainOperationState(db, pageId, mapped.domainStatus === 'active'
      ? {
        resetRetry: true,
        clearEscalation: true,
        lastErrorCode: '',
        lastAttemptAt: checkedAt,
      }
      : {
        incrementRetry: true,
        nextRetryAt: decision.nextRetryAt,
        lastErrorCode: mapped.domainStatus === 'failed' ? 'DOMAIN_PROVIDER_VERIFICATION_FAILED' : '',
        lastAttemptAt: checkedAt,
        escalate: decision.escalated,
      });

    return {
      ok: true,
      action: 'verify',
      source,
      providerConfigured: true,
      operatorRequired: decision.escalated,
      message: mapped.domainStatus === 'active'
        ? '개인 도메인과 SSL 연결이 완료되었습니다.'
        : (mapped.domainStatus === 'failed'
          ? '도메인 또는 SSL 확인에 실패했습니다. 운영 확인 목록에 추가했습니다.'
          : 'DNS와 SSL 연결 상태를 확인하고 있습니다.'),
      current: publicDomainRecord(current),
      dns,
    };
  } catch (error) {
    const classification = classifyPageDomainProviderError(error);
    const decision = pageDomainRetryDecision(record, {
      failed: !classification.retryable,
      retryable: classification.retryable,
      maxRetries: pageDomainMaxRetries(env),
    }, checkedAt);
    await updateD1PageDomainVerification(db, pageId, {
      domainStatus: classification.retryable ? 'verifying' : 'failed',
      sslStatus: classification.retryable
        ? (String(record.ssl_status || '') === 'active' ? 'active' : 'pending')
        : 'failed',
      failureReason: error?.message || '도메인 연결 확인에 실패했습니다.',
      provider: 'cloudflare_pages',
      providerStatus: classification.retryable ? 'retry_wait' : 'error',
      checkedAt,
      providerSyncedAt: new Date().toISOString(),
    });
    await updateD1PageDomainOperationState(db, pageId, {
      incrementRetry: true,
      nextRetryAt: decision.nextRetryAt,
      lastErrorCode: classification.code,
      lastAttemptAt: checkedAt,
      escalate: decision.escalated,
    });
    error.details = {
      ...(error?.details || {}),
      retryable: classification.retryable,
      nextRetryAt: decision.nextRetryAt,
      escalated: decision.escalated,
      source,
    };
    throw error;
  }
}
