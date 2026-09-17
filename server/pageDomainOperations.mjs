import {
  cloudflarePagesDomainReadiness,
  deleteCloudflarePagesDomain,
  ensureCloudflarePagesDomain,
  inspectCustomDomainDns,
  mapCloudflarePagesDomain,
} from './cloudflarePagesDomains.mjs';
import {
  disconnectD1PageDomain,
  getD1PageDomainByPageId,
  publicDomainRecord,
  updateD1PageDomainVerification,
} from './pageDomainStore.mjs';

const RETRY_MINUTES = [5, 15, 30, 60, 180, 360];
const DEFAULT_MAX_RETRIES = 8;
const ESCALATE_AFTER_RETRIES = 6;
const ESCALATE_AFTER_HOURS = 24;

function safeInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function asDate(value, fallback = new Date()) {
  const parsed = value instanceof Date ? value : new Date(value || fallback);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
}

export function pageDomainRetryDelayMinutes(retryCount = 1) {
  const count = safeInteger(retryCount, 1, 1, 100);
  return RETRY_MINUTES[Math.min(RETRY_MINUTES.length - 1, count - 1)];
}

export function nextPageDomainRetryAt(retryCount = 1, now = new Date()) {
  const base = asDate(now);
  return new Date(base.getTime() + (pageDomainRetryDelayMinutes(retryCount) * 60_000)).toISOString();
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

function ageHours(record = {}, now = new Date()) {
  const created = asDate(record.created_at || record.updated_at || now, now);
  return Math.max(0, (asDate(now).getTime() - created.getTime()) / 3_600_000);
}

function retryDecision(record = {}, { active = false, retryable = true, failed = false, maxRetries = DEFAULT_MAX_RETRIES } = {}, now = new Date()) {
  if (active) return { retryCount: 0, nextRetryAt: '', escalatedAt: null, terminal: true };
  const retryCount = Number(record.retry_count || 0) + 1;
  const exhausted = retryCount >= maxRetries;
  const escalated = failed || !retryable || exhausted || retryCount >= ESCALATE_AFTER_RETRIES || ageHours(record, now) >= ESCALATE_AFTER_HOURS;
  return {
    retryCount,
    nextRetryAt: (!retryable || exhausted) ? '' : nextPageDomainRetryAt(retryCount, now),
    escalatedAt: escalated ? asDate(now).toISOString() : null,
    terminal: !retryable || exhausted,
  };
}

export async function verifyPageDomainConnection({ db, env = {}, pageId = '', record = null, fetchImpl = globalThis.fetch, source = 'manual' } = {}) {
  const current = record || await getD1PageDomainByPageId(db, pageId);
  if (!current) {
    const error = new Error('저장된 개인 도메인 정보를 찾을 수 없습니다.');
    error.status = 404;
    error.code = 'DOMAIN_CONNECTION_NOT_FOUND';
    throw error;
  }

  const readiness = cloudflarePagesDomainReadiness(env);
  const dns = await inspectCustomDomainDns(env, current.hostname || '', fetchImpl);
  const checkedAt = dns.checkedAt || new Date().toISOString();

  if (!readiness.configured) {
    const decision = retryDecision(current, { retryable: true }, checkedAt);
    const updated = await updateD1PageDomainVerification(db, pageId, {
      domainStatus: 'pending',
      sslStatus: String(current.ssl_status || '') === 'active' ? 'active' : 'pending',
      provider: 'cloudflare_pages',
      providerStatus: 'not_configured',
      checkedAt,
      retryCount: decision.retryCount,
      nextRetryAt: decision.nextRetryAt,
      lastErrorCode: 'DOMAIN_PROVIDER_NOT_CONFIGURED',
      escalatedAt: decision.escalatedAt,
      lastAttemptAt: checkedAt,
    });
    return {
      ok: true,
      action: 'verify',
      source,
      providerConfigured: false,
      operatorRequired: true,
      message: '운영 도메인 연결 설정이 준비되지 않았습니다.',
      current: publicDomainRecord(updated),
      dns,
    };
  }

  try {
    const providerResult = await ensureCloudflarePagesDomain(env, current.hostname || '', fetchImpl);
    const mapped = mapCloudflarePagesDomain(providerResult, dns);
    const decision = retryDecision(current, {
      active: mapped.domainStatus === 'active',
      failed: mapped.domainStatus === 'failed',
      retryable: mapped.domainStatus !== 'failed',
      maxRetries: safeInteger(env.INLET_DOMAIN_RECHECK_MAX_RETRIES, DEFAULT_MAX_RETRIES, 1, 20),
    }, checkedAt);
    const updated = await updateD1PageDomainVerification(db, pageId, {
      ...mapped,
      checkedAt,
      providerSyncedAt: new Date().toISOString(),
      retryCount: decision.retryCount,
      nextRetryAt: decision.nextRetryAt,
      lastErrorCode: mapped.domainStatus === 'failed' ? 'DOMAIN_PROVIDER_VERIFICATION_FAILED' : '',
      escalatedAt: decision.escalatedAt,
      lastAttemptAt: checkedAt,
    });
    return {
      ok: true,
      action: 'verify',
      source,
      providerConfigured: true,
      operatorRequired: Boolean(decision.escalatedAt),
      message: mapped.domainStatus === 'active'
        ? '개인 도메인과 SSL 연결이 완료되었습니다.'
        : (mapped.domainStatus === 'failed'
          ? '도메인 또는 SSL 확인에 실패했습니다.'
          : (dns.matched ? 'SSL 연결 상태를 확인하고 있습니다.' : 'DNS CNAME 설정을 확인해주세요.')),
      current: publicDomainRecord(updated),
      dns,
    };
  } catch (error) {
    const classification = classifyPageDomainProviderError(error);
    const decision = retryDecision(current, {
      retryable: classification.retryable,
      failed: !classification.retryable,
      maxRetries: safeInteger(env.INLET_DOMAIN_RECHECK_MAX_RETRIES, DEFAULT_MAX_RETRIES, 1, 20),
    }, checkedAt);
    await updateD1PageDomainVerification(db, pageId, {
      domainStatus: classification.retryable ? 'verifying' : 'failed',
      sslStatus: classification.retryable && String(current.ssl_status || '') === 'active' ? 'active' : (classification.retryable ? 'pending' : 'failed'),
      failureReason: classification.retryable ? '' : String(error?.message || '도메인 연결 확인에 실패했습니다.'),
      provider: 'cloudflare_pages',
      providerStatus: classification.retryable ? 'retry_wait' : 'error',
      checkedAt,
      providerSyncedAt: new Date().toISOString(),
      retryCount: decision.retryCount,
      nextRetryAt: decision.nextRetryAt,
      lastErrorCode: classification.code,
      escalatedAt: decision.escalatedAt,
      lastAttemptAt: checkedAt,
    });
    error.details = {
      ...(error?.details || {}),
      retryable: classification.retryable,
      nextRetryAt: decision.nextRetryAt,
      escalated: Boolean(decision.escalatedAt),
      source,
    };
    throw error;
  }
}

function providerAttachmentMayExist(record = {}) {
  if (String(record.provider_domain_id || '').trim()) return true;
  if (String(record.provider || '').trim().toLowerCase() !== 'cloudflare_pages') return false;
  return !['', 'missing', 'not_configured', 'deactivated'].includes(String(record.provider_status || '').trim().toLowerCase());
}

export async function detachPageDomainConnection({ db, env = {}, pageId = '', record = null, fetchImpl = globalThis.fetch } = {}) {
  const current = record || await getD1PageDomainByPageId(db, pageId);
  if (!current) return { ok: true, action: 'detach', alreadyDetached: true, current: null };
  if (String(current.status || '') === 'disconnected') {
    return { ok: true, action: 'detach', alreadyDetached: true, current: publicDomainRecord(current) };
  }

  const readiness = cloudflarePagesDomainReadiness(env);
  const attachmentMayExist = providerAttachmentMayExist(current);
  if (!readiness.configured && attachmentMayExist) {
    const error = new Error('Cloudflare 도메인 제거 설정이 없어 안전하게 연결을 해제할 수 없습니다.');
    error.status = 503;
    error.code = 'DOMAIN_PROVIDER_CLEANUP_REQUIRED';
    error.details = { code: error.code, operatorRequired: true };
    throw error;
  }

  let providerResult = { deleted: false, missing: !attachmentMayExist };
  if (readiness.configured && current.hostname) {
    providerResult = await deleteCloudflarePagesDomain(env, current.hostname, fetchImpl);
  }
  const updated = await disconnectD1PageDomain(db, pageId, {
    providerStatus: providerResult.deleted ? 'deactivated' : (providerResult.missing ? 'missing' : 'not_configured'),
  });
  return {
    ok: true,
    action: 'detach',
    alreadyDetached: false,
    providerConfigured: readiness.configured,
    providerDeleted: Boolean(providerResult.deleted),
    providerMissing: Boolean(providerResult.missing),
    message: '개인 도메인 연결을 해제했습니다.',
    current: publicDomainRecord(updated),
  };
}
