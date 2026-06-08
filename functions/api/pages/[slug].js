import { decodeD1Page, getD1PageBySlug, getD1ProjectById, upsertD1Page } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, ensureD1ProjectShell, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson, sessionIdentity } from '../_shared.js';

const METHODS = 'GET, POST, OPTIONS';
const PUBLIC_PAGE_CACHE_CONTROL = 'no-store';
const PUBLIC_PAGE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': METHODS,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Inlet-Api-Token, X-Inlet-Owner-Id, X-Inlet-Project-Id, X-Inlet-Session',
  'Access-Control-Max-Age': '86400',
};

function safeSlug(value = '') {
  return String(value || 'my-page').replace(/[^a-zA-Z0-9-_]/g, '') || 'my-page';
}

function publicPagePayload(page = {}, project = {}) {
  return {
    ...page,
    projectId: page.projectId || project.projectId || project.id || '',
    slug: page.slug || project.slug || '',
    ownership: undefined,
    ai: undefined,
    integrations: {
      conversion: page.integrations?.conversion || {},
    },
  };
}

function pageNotFoundResponse(request, env) {
  return jsonResponse(request, env, 404, { ok: false, error: '페이지를 찾을 수 없습니다.', message: '페이지를 찾을 수 없습니다.' }, METHODS);
}

function methodNotAllowedResponse(request, env) {
  return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.', message: '허용되지 않는 요청 방식입니다.' }, METHODS);
}

function isFreePlan(value = '') {
  const plan = String(value || 'free').trim().toLowerCase();
  return !['paid', 'pro', 'premium', 'business', 'agency', 'enterprise'].includes(plan);
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function stableHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function safeProjectId(value = '') {
  return String(value || '').replace(/[^a-zA-Z0-9-_]/g, '');
}

function identityOwnerId(identity = {}) {
  const explicit = safeProjectId(identity?.ownerId || '');
  if (explicit) return explicit;
  const email = normalizeEmail(identity?.email || '');
  return email ? `user_${stableHash(email)}` : '';
}

function canRecoverPageSaveProject(error = {}, identity = {}) {
  const status = Number(error?.status || 0);
  const role = String(identity?.role || 'master').trim().toLowerCase();
  if (!['master', 'owner', 'builder'].includes(role)) return false;
  if (!identityOwnerId(identity)) return false;
  return status === 403 || /Project access|PROJECT_ACCESS/i.test(String(error?.message || error || ''));
}

function accountOwnedProjectForSave(project = {}, identity = {}, slug = '') {
  const ownerId = identityOwnerId(identity);
  const safeSlug = safeProjectId(slug || project.slug || 'my-page') || 'my-page';
  return {
    ...project,
    projectId: `${ownerId}_${safeSlug}`,
    id: `${ownerId}_${safeSlug}`,
    ownerId,
    ownerAccountId: ownerId,
    slug: safeSlug,
    title: project.title || safeSlug,
  };
}

async function fallbackFreeEmailAlertRecipient(db, project = {}) {
  const projectId = String(project.projectId || project.id || '').trim();
  const projectRow = projectId ? await getD1ProjectById(db, projectId) : null;
  const ownerId = String(project.ownerId || project.ownerAccountId || projectRow?.ownerId || projectRow?.ownerAccountId || '').trim();
  const clientEmail = normalizeEmail(project.clientEmail || projectRow?.clientEmail || '');
  if (clientEmail) return clientEmail;
  if (!ownerId) return '';
  const account = await db.prepare('SELECT email FROM accounts WHERE id = ? LIMIT 1').bind(ownerId).first();
  return normalizeEmail(account?.email || '');
}

function enforceFreeEmailAlertRecipient(page = {}, project = {}, identity = null, fallbackEmail = '') {
  const email = normalizeEmail(identity?.email || fallbackEmail);
  if (!email) return page;
  const plan = page.plan || page.billingPlan || page.billing?.plan || project.plan || project.billingPlan || 'free';
  if (!isFreePlan(plan)) return page;
  const integrations = page.integrations && typeof page.integrations === 'object' ? page.integrations : {};
  const emailIntegration = integrations.email && typeof integrations.email === 'object' ? integrations.email : {};
  return {
    ...page,
    integrations: {
      ...integrations,
      email: {
        ...emailIntegration,
        to: email,
        lockedToAccount: true,
      },
    },
  };
}

async function getPublicPageBySlug(db, slug) {
  const row = await db.prepare(`
    SELECT pages.*
    FROM pages
    LEFT JOIN projects ON projects.id = pages.project_id
    WHERE pages.slug = ?
      AND COALESCE(projects.status, 'active') <> 'archived'
    ORDER BY pages.updated_at DESC, pages.revision DESC, projects.updated_at DESC, pages.id DESC
    LIMIT 1
  `).bind(slug).first();
  if (!row) return { page: null, project: null };
  const page = decodeD1Page(row);
  return { page, project: { projectId: page.projectId, slug: page.slug } };
}

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);

  try {
    const url = new URL(request.url);
    const slug = safeSlug(params?.slug);
    const db = assertD1(env);

    if (request.method === 'GET') {
      const project = projectFromRequest(url, {}, request);
      if (url.searchParams.get('public') === '1') {
        const result = project.projectId
          ? { project, page: await getD1PageBySlug(db, { projectId: project.projectId, slug }) }
          : await getPublicPageBySlug(db, slug);
        const { page, project: publicProject } = result;
        if (!page) return pageNotFoundResponse(request, env);
        if (!page) return jsonResponse(request, env, 404, { ok: false, error: '페이지를 찾을 수 없습니다.', message: '페이지를 찾을 수 없습니다.' }, METHODS);
        return jsonResponse(request, env, 200, { ok: true, page: publicPagePayload(page, publicProject) }, METHODS, {
          cacheControl: PUBLIC_PAGE_CACHE_CONTROL,
          headers: PUBLIC_PAGE_HEADERS,
        });
      }
      await authorizeProject(request, env, project);
      const page = await getD1PageBySlug(db, { projectId: project.projectId, slug });
      if (!page) return pageNotFoundResponse(request, env);
      if (!page) return jsonResponse(request, env, 404, { ok: false, error: '페이지를 찾을 수 없습니다.', message: '페이지를 찾을 수 없습니다.' }, METHODS);
      return jsonResponse(request, env, 200, { ok: true, page }, METHODS);
    }

    if (request.method === 'POST') {
      const body = await readJson(request);
      let project = projectFromRequest(url, body, request);
      const writeTab = String(body.tab || body.saveTab || 'edit').trim() || 'edit';
      const identity = await sessionIdentity(request, env);
      const incoming = body.page && typeof body.page === 'object' ? body.page : body;
      try {
        await ensureD1ProjectShell(db, project);
        await authorizeProject(request, env, project, { write: true, tab: writeTab });
      } catch (error) {
        if (!canRecoverPageSaveProject(error, identity)) throw error;
        project = accountOwnedProjectForSave(project, identity, slug);
        await ensureD1ProjectShell(db, project);
        await authorizeProject(request, env, project, { write: true, tab: writeTab });
      }
      const publicExisting = await getPublicPageBySlug(db, slug);
      if (publicExisting.page && String(publicExisting.page.projectId || '') !== String(project.projectId || '')) {
        const error = new Error('Page URL is already in use.');
        error.status = 409;
        error.details = { code: 'PAGE_SLUG_CONFLICT', slug };
        throw error;
      }
      const expectedUpdatedAt = String(body.expectedUpdatedAt || incoming.expectedUpdatedAt || incoming.__expectedUpdatedAt || '').trim();
      const current = await getD1PageBySlug(db, { projectId: project.projectId, slug });
      const currentUpdatedAt = String(current?.updatedAt || '').trim();
      if (expectedUpdatedAt && currentUpdatedAt && expectedUpdatedAt !== currentUpdatedAt) {
        const error = new Error('Page revision conflict');
        error.status = 409;
        error.details = {
          code: 'PAGE_REVISION_CONFLICT',
          latest: current ? {
            slug: current.slug || slug,
            title: current.title || '',
            updatedAt: current.updatedAt || '',
            blocks: Array.isArray(current.blocks) ? current.blocks.length : 0,
          } : null,
          page: current || null,
        };
        throw error;
      }
      const fallbackEmail = await fallbackFreeEmailAlertRecipient(db, project);
      const pageForSave = enforceFreeEmailAlertRecipient({ ...incoming, slug }, project, identity, fallbackEmail);
      const saved = await upsertD1Page(db, pageForSave, {
        projectId: project.projectId,
        slug,
        createdByAccountId: identity?.ownerId || project.ownerId || null,
        reason: body.reason || body.revisionReason || '',
      });
      return jsonResponse(request, env, 200, { ok: true, page: saved }, METHODS);
    }

    return methodNotAllowedResponse(request, env);
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.', message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
