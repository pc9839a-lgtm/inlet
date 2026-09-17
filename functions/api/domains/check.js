import {
  assertD1PageBelongsToProject,
  assertD1PageDomainAvailable,
  getD1PageDomainByPageId,
  normalizeDomainHostname,
  publicDomainRecord,
} from '../../../server/pageDomainStore.mjs';
import { cloudflarePagesDomainReadiness } from '../../../server/cloudflarePagesDomains.mjs';
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

function invalidDomain(message = '도메인 주소를 확인해주세요.') {
  const error = new Error(message);
  error.status = 400;
  error.code = 'DOMAIN_INVALID';
  error.details = { code: error.code };
  return error;
}

function validateHostname(value = '') {
  const hostname = normalizeDomainHostname(value);
  if (!hostname || hostname.length > 253 || !hostname.includes('.')) throw invalidDomain();
  if (!hostname.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw invalidDomain();
  if (hostname === 'pagero.kr' || hostname.endsWith('.pagero.kr')) throw invalidDomain('PageRo 서비스 도메인은 개인 도메인으로 사용할 수 없습니다.');
  if (hostname === 'pages.dev' || hostname.endsWith('.pages.dev')) throw invalidDomain('Pages 서비스 도메인은 개인 도메인으로 사용할 수 없습니다.');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw invalidDomain();
  return hostname;
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const body = await readJson(request);
    const project = projectFromRequest(new URL(request.url), body, request);
    await authorizeProject(request, env, project, { tab: 'settings' });
    const db = assertD1(env);
    const pageId = String(body.pageId || '').trim();
    await assertD1PageBelongsToProject(db, project.projectId, pageId);

    const requested = String(body.hostname || body.customDomain || '').trim();
    const hostname = requested ? validateHostname(requested) : '';
    if (hostname) await assertD1PageDomainAvailable(db, hostname, pageId);
    const current = await getD1PageDomainByPageId(db, pageId);
    if (current && String(current.project_id || '') !== String(project.projectId || '')) {
      const error = new Error('현재 프로젝트의 도메인 정보가 아닙니다.');
      error.status = 403;
      error.code = 'DOMAIN_PROJECT_MISMATCH';
      throw error;
    }

    const readiness = cloudflarePagesDomainReadiness(env);
    return jsonResponse(request, env, 200, {
      ok: true,
      available: true,
      hostname: hostname || String(current?.hostname || ''),
      current: publicDomainRecord(current),
      providerConfigured: readiness.configured,
      dns: {
        configured: Boolean(readiness.cnameTarget),
        type: 'CNAME',
        target: readiness.cnameTarget,
      },
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
