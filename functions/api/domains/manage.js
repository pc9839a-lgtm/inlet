import {
  cloudflarePagesDomainReadiness,
  deleteCloudflarePagesDomain,
  ensureCloudflarePagesDomain,
  inspectCustomDomainDns,
  mapCloudflarePagesDomain,
} from '../../../server/cloudflarePagesDomains.mjs';
import {
  disconnectD1PageDomain,
  getD1PageDomainByPageId,
  publicDomainRecord,
  updateD1PageDomainVerification,
} from '../../../server/pageDomainStore.mjs';
import { normalizeDomainHostname } from '../../../src/lib/pageDomains.js';
import {
  assertD1,
  authorizeProject,
  handleApiError,
  jsonResponse,
  optionsResponse,
  projectFromRequest,
  readJson,
} from '../_shared.js';

const METHODS = 'POST, OPTIONS';

function endpointError(message, status, code, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = { code, ...details };
  return error;
}

function assertDomainRecord(record, project = {}, pageId = '', hostname = '') {
  if (!record) {
    throw endpointError('저장된 개인 도메인 정보를 찾을 수 없습니다.', 404, 'DOMAIN_CONNECTION_NOT_FOUND');
  }
  if (String(record.project_id || '') !== String(project.projectId || '')) {
    throw endpointError('현재 프로젝트의 도메인 정보가 아닙니다.', 403, 'DOMAIN_PROJECT_MISMATCH');
  }
  if (String(record.page_id || '') !== String(pageId || '')) {
    throw endpointError('현재 페이지의 도메인 정보가 아닙니다.', 409, 'DOMAIN_PAGE_MISMATCH');
  }
  const safeHostname = normalizeDomainHostname(hostname);
  if (safeHostname && safeHostname !== normalizeDomainHostname(record.hostname || '')) {
    throw endpointError('저장된 도메인과 확인 요청 도메인이 다릅니다.', 409, 'DOMAIN_HOSTNAME_MISMATCH');
  }
  return record;
}

async function verifyDomain({ db, env, pageId, record }) {
  const readiness = cloudflarePagesDomainReadiness(env);
  const dns = await inspectCustomDomainDns(env, record.hostname || '');

  if (!readiness.configured) {
    const current = await updateD1PageDomainVerification(db, pageId, {
      domainStatus: 'pending',
      sslStatus: 'pending',
      failureReason: '',
      provider: 'cloudflare_pages',
      providerStatus: 'not_configured',
      checkedAt: dns.checkedAt,
    });
    return {
      ok: true,
      action: 'verify',
      providerConfigured: false,
      operatorRequired: true,
      message: '운영 도메인 연결 설정이 준비 중입니다.',
      current: publicDomainRecord(current),
      dns,
    };
  }

  try {
    const providerResult = await ensureCloudflarePagesDomain(env, record.hostname || '');
    const mapped = mapCloudflarePagesDomain(providerResult, dns);
    const current = await updateD1PageDomainVerification(db, pageId, {
      ...mapped,
      checkedAt: dns.checkedAt,
      providerSyncedAt: new Date().toISOString(),
    });
    return {
      ok: true,
      action: 'verify',
      providerConfigured: true,
      operatorRequired: false,
      message: mapped.domainStatus === 'active'
        ? '개인 도메인과 SSL 연결이 완료되었습니다.'
        : 'DNS와 SSL 연결 상태를 확인하고 있습니다.',
      current: publicDomainRecord(current),
      dns,
    };
  } catch (error) {
    await updateD1PageDomainVerification(db, pageId, {
      domainStatus: 'failed',
      sslStatus: 'failed',
      failureReason: error?.message || '도메인 연결 확인에 실패했습니다.',
      provider: 'cloudflare_pages',
      providerStatus: 'error',
      checkedAt: dns.checkedAt,
      providerSyncedAt: new Date().toISOString(),
    });
    throw error;
  }
}

async function detachDomain({ db, env, pageId, record }) {
  const readiness = cloudflarePagesDomainReadiness(env);
  let providerResult = { deleted: false, missing: false };
  if (readiness.configured && record.hostname) {
    providerResult = await deleteCloudflarePagesDomain(env, record.hostname);
  }
  const current = await disconnectD1PageDomain(db, pageId, {
    providerStatus: providerResult.deleted ? 'deactivated' : (readiness.configured ? 'missing' : 'not_configured'),
  });
  return {
    ok: true,
    action: 'detach',
    providerConfigured: readiness.configured,
    operatorRequired: !readiness.configured,
    providerDeleted: !!providerResult.deleted,
    message: '개인 도메인 연결을 해제했습니다.',
    current: publicDomainRecord(current),
  };
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
      message: '허용되지 않는 요청 방식입니다.',
    }, METHODS);
  }

  try {
    const body = await readJson(request);
    const project = projectFromRequest(new URL(request.url), body, request);
    await authorizeProject(request, env, project, { write: true, tab: 'settings', masterOnly: true });

    const pageId = String(body.pageId || '').trim();
    if (!pageId) throw endpointError('페이지 정보가 누락되었습니다.', 400, 'DOMAIN_PAGE_IDENTITY_REQUIRED');
    const action = String(body.action || 'verify').trim().toLowerCase();
    if (!['verify', 'detach'].includes(action)) {
      throw endpointError('지원하지 않는 도메인 작업입니다.', 400, 'DOMAIN_ACTION_INVALID');
    }

    const db = assertD1(env);
    const record = assertDomainRecord(
      await getD1PageDomainByPageId(db, pageId),
      project,
      pageId,
      body.customDomain || body.hostname || '',
    );

    const result = action === 'detach'
      ? await detachDomain({ db, env, pageId, record })
      : await verifyDomain({ db, env, pageId, record });
    return jsonResponse(request, env, 200, result, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
