import {
  normalizePageDomainConfig,
  pageDomainIssues,
} from '../../../src/lib/pageDomains.js';
import {
  assertD1PageDomainAvailable,
  getD1PageDomainByPageId,
  publicDomainRecord,
} from '../../../server/pageDomainStore.mjs';
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

async function assertAuthorizedPage(db, project = {}, pageId = '') {
  if (!pageId) return null;
  const page = await db.prepare('SELECT id, project_id FROM pages WHERE id = ? LIMIT 1').bind(pageId).first();
  if (!page) throw endpointError('페이지 정보를 찾을 수 없습니다.', 404, 'DOMAIN_PAGE_NOT_FOUND');
  if (String(page.project_id || '') !== String(project.projectId || '')) {
    throw endpointError('현재 프로젝트의 페이지가 아닙니다.', 403, 'DOMAIN_PROJECT_MISMATCH');
  }
  return page;
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
    await authorizeProject(request, env, project, { write: true, tab: 'settings' });

    const rawDomain = {
      domainType: 'custom',
      customDomain: body.customDomain || body.hostname || '',
    };
    const issues = pageDomainIssues(rawDomain);
    if (issues.length) {
      return jsonResponse(request, env, 400, {
        ok: false,
        available: false,
        code: 'DOMAIN_INVALID',
        error: issues[0],
        message: issues[0],
        issues,
      }, METHODS);
    }
    const domain = normalizePageDomainConfig({
      ...rawDomain,
      domainStatus: 'pending',
      slug: body.slug || project.slug || 'my-page',
    });

    const db = assertD1(env);
    const pageId = String(body.pageId || '').trim();
    await assertAuthorizedPage(db, project, pageId);
    await assertD1PageDomainAvailable(db, domain.customDomain, pageId);
    const current = pageId ? await getD1PageDomainByPageId(db, pageId) : null;
    if (current && String(current.project_id || '') !== String(project.projectId || '')) {
      throw endpointError('현재 프로젝트의 도메인 정보가 아닙니다.', 403, 'DOMAIN_PROJECT_MISMATCH');
    }
    const samePage = current && String(current.hostname || '') === domain.customDomain;
    const cnameTarget = String(env.INLET_CUSTOM_DOMAIN_CNAME_TARGET || '').trim().toLowerCase();

    return jsonResponse(request, env, 200, {
      ok: true,
      available: true,
      customDomain: domain.customDomain,
      domainStatus: samePage ? String(current.status || 'pending') : 'pending',
      sslStatus: samePage ? String(current.ssl_status || 'pending') : 'pending',
      current: samePage ? publicDomainRecord(current) : null,
      dns: {
        configured: !!cnameTarget,
        type: 'CNAME',
        host: domain.customDomain,
        target: cnameTarget,
      },
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
