import { decodeD1Page, getD1PageBySlug, getD1ProjectById, upsertD1Page } from '../../../server/storage/d1Adapter.mjs';
import {
  assertExpectedPageVersion,
  assertTargetSlugAvailable,
  assertUpdatePageIdentity,
  pageSaveIdentity,
} from '../../../server/pageSavePolicy.mjs';
import { assertD1, authorizeProject, ensureD1ProjectShell, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson, sessionIdentity } from '../_shared.js';

const METHODS = 'GET, POST, DELETE, OPTIONS';
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
  const safeSlugValue = safeProjectId(slug || project.slug || 'my-page') || 'my-page';
  return {
    ...project,
    projectId: `${ownerId}_${safeSlugValue}`,
    id: `${ownerId}_${safeSlugValue}`,
    ownerId,
    ownerAccountId: ownerId,
    slug: safeSlugValue,
    title: project.title || safeSlugValue,
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

async function getPageById(db, pageId = '') {
  const safePageId = String(pageId || '').trim();
  if (!safePageId) return null;
  const row = await db.prepare('SELECT * FROM pages WHERE id = ? LIMIT 1').bind(safePageId).first();
  return row ? decodeD1Page(row) : null;
}

async function authorizeNewPageProject({ db, request, env, project, identity, slug, writeTab }) {
  let targetProject = project;
  try {
    await ensureD1ProjectShell(db, targetProject);
    await authorizeProject(request, env, targetProject, { write: true, tab: writeTab });
  } catch (error) {
    if (!canRecoverPageSaveProject(error, identity)) throw error;
    targetProject = accountOwnedProjectForSave(targetProject, identity, slug);
    await ensureD1ProjectShell(db, targetProject);
    await authorizeProject(request, env, targetProject, { write: true, tab: writeTab });
  }
  return targetProject;
}

async function authorizeExistingPageProject({ db, request, env, currentPage, fallbackProject, writeTab }) {
  const existingProject = await getD1ProjectById(db, currentPage?.projectId || '');
  if (!existingProject?.projectId) {
    const error = new Error('Existing page project could not be found.');
    error.status = 409;
    error.details = { code: 'PAGE_SAVE_IDENTITY_REQUIRED', pageId: currentPage?.id || '' };
    throw error;
  }
  const targetProject = {
    ...fallbackProject,
    ...existingProject,
    id: existingProject.projectId,
    projectId: existingProject.projectId,
    ownerId: existingProject.ownerId || fallbackProject.ownerId || '',
    slug: currentPage.slug || existingProject.slug || fallbackProject.slug || '',
  };
  await authorizeProject(request, env, targetProject, { write: true, tab: writeTab });
  return targetProject;
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
        return jsonResponse(request, env, 200, { ok: true, page: publicPagePayload(page, publicProject) }, METHODS, {
          cacheControl: PUBLIC_PAGE_CACHE_CONTROL,
          headers: PUBLIC_PAGE_HEADERS,
        });
      }
      await authorizeProject(request, env, project);
      const page = await getD1PageBySlug(db, { projectId: project.projectId, slug });
      if (!page) return pageNotFoundResponse(request, env);
      return jsonResponse(request, env, 200, { ok: true, page }, METHODS);
    }

    if (request.method === 'DELETE') {
      const project = projectFromRequest(url, {}, request);
      await authorizeProject(request, env, project, { write: true, tab: 'settings' });
      const page = await getD1PageBySlug(db, { projectId: project.projectId, slug });
      if (!page) return pageNotFoundResponse(request, env);

      const archivedAt = new Date().toISOString();
      await db.prepare(`
        UPDATE projects
        SET status = 'archived', updated_at = ?
        WHERE id = ?
      `).bind(archivedAt, project.projectId).run();

      return jsonResponse(request, env, 200, {
        ok: true,
        deleted: {
          projectId: project.projectId,
          slug,
          archivedAt,
        },
      }, METHODS);
    }

    if (request.method === 'POST') {
      const body = await readJson(request);
      let project = projectFromRequest(url, body, request);
      const writeTab = String(body.tab || body.saveTab || 'edit').trim() || 'edit';
      const session = await sessionIdentity(request, env);
      const incoming = body.page && typeof body.page === 'object' ? body.page : body;
      const saveIdentity = pageSaveIdentity(body, incoming, project, slug);
      const saveMode = saveIdentity.mode;
      const currentById = saveIdentity.pageId ? await getPageById(db, saveIdentity.pageId) : null;

      assertUpdatePageIdentity({ mode: saveMode, identity: saveIdentity, currentById });

      if (saveMode === 'update-existing') {
        project = await authorizeExistingPageProject({
          db,
          request,
          env,
          currentPage: currentById,
          fallbackProject: project,
          writeTab,
        });
      } else {
        project = await authorizeNewPageProject({ db, request, env, project, identity: session, slug, writeTab });
      }

      const publicExisting = await getPublicPageBySlug(db, slug);
      const targetState = assertTargetSlugAvailable({
        mode: saveMode,
        identity: { ...saveIdentity, slug },
        existingPage: publicExisting.page,
        targetProjectId: project.projectId,
      });

      if (targetState.replayed && targetState.page) {
        return jsonResponse(request, env, 200, {
          ok: true,
          replayed: true,
          saveMode,
          saveRequestId: body.saveRequestId || '',
          page: targetState.page,
        }, METHODS);
      }

      const current = saveMode === 'update-existing'
        ? currentById
        : await getD1PageBySlug(db, { projectId: project.projectId, slug });
      assertExpectedPageVersion({
        expectedUpdatedAt: body.expectedUpdatedAt || incoming.expectedUpdatedAt || incoming.__expectedUpdatedAt || '',
        expectedRevision: body.expectedRevision || body.identity?.revision || incoming.expectedRevision || 0,
        currentPage: current,
        slug,
      });

      const fallbackEmail = await fallbackFreeEmailAlertRecipient(db, project);
      const pageForSave = enforceFreeEmailAlertRecipient({
        ...incoming,
        id: currentById?.id || incoming.id || saveIdentity.pageId || '',
        projectId: project.projectId,
        ownerId: project.ownerId || incoming.ownerId || '',
        slug,
      }, project, session, fallbackEmail);
      const saved = await upsertD1Page(db, pageForSave, {
        pageId: currentById?.id || saveIdentity.pageId || '',
        projectId: project.projectId,
        slug,
        createdByAccountId: session?.ownerId || project.ownerId || null,
        reason: body.reason || body.revisionReason || '',
      });
      return jsonResponse(request, env, 200, {
        ok: true,
        replayed: false,
        saveMode,
        saveRequestId: body.saveRequestId || '',
        page: saved,
      }, METHODS);
    }

    return methodNotAllowedResponse(request, env);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
