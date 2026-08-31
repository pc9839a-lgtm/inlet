import { pageSaveIdentity } from '../../../server/pageSavePolicy.mjs';
import { assertD1, jsonResponse, projectFromRequest, sessionIdentity } from '../_shared.js';
import { isPlatformMasterIdentity } from '../_platformMaster.js';

const METHODS = 'POST, OPTIONS';
const GENERAL_ACCOUNT_PAGE_LIMIT = 1;

function exactPageRoute(request) {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  if (parts.length !== 3 || parts[0] !== 'api' || parts[1] !== 'pages') return null;
  try {
    return decodeURIComponent(parts[2]);
  } catch {
    return parts[2];
  }
}

async function ownedTargetExists(db, ownerId, identity = {}, slug = '') {
  const projectId = String(identity.projectId || '').trim();
  const pageId = String(identity.pageId || '').trim();
  if (!projectId && !pageId) return false;

  const row = await db.prepare(`
    SELECT pages.id
    FROM pages
    JOIN projects ON projects.id = pages.project_id
    WHERE projects.owner_account_id = ?
      AND COALESCE(projects.status, 'active') NOT IN ('archived', 'deleted')
      AND pages.slug = ?
      AND (? = '' OR pages.project_id = ?)
      AND (? = '' OR pages.id = ?)
    LIMIT 1
  `).bind(ownerId, slug, projectId, projectId, pageId, pageId).first();
  return !!row?.id;
}

async function activeOwnedPageCount(db, ownerId) {
  const row = await db.prepare(`
    SELECT COUNT(DISTINCT projects.id) AS count
    FROM projects
    JOIN pages ON pages.project_id = projects.id
    WHERE projects.owner_account_id = ?
      AND COALESCE(projects.status, 'active') NOT IN ('archived', 'deleted')
  `).bind(ownerId).first();
  return Math.max(0, Number(row?.count || 0));
}

async function canFastPathExistingSave(request, env, slug) {
  const url = new URL(request.url);
  if (url.searchParams.get('saveMode') !== 'update-existing') return false;
  const projectId = String(url.searchParams.get('projectId') || '').trim();
  const pageId = String(url.searchParams.get('pageId') || '').trim();
  if (!projectId || !pageId) return false;

  const identity = await sessionIdentity(request, env);
  if (!identity?.ownerId || isPlatformMasterIdentity(identity, env)) return !!identity?.ownerId;
  const db = assertD1(env);
  return ownedTargetExists(db, identity.ownerId, { projectId, pageId }, slug);
}

export async function onRequest({ request, env, next }) {
  if (request.method !== 'POST') return next();
  const slug = exactPageRoute(request);
  if (!slug) return next();

  // 정상적인 기존 페이지 저장은 최대 1.8MB JSON body를 clone+parse할 필요가 없다.
  // URL 힌트만 신뢰하지 않고 signed session 소유권과 실제 page/project 조합까지 확인한 뒤 fast-path 한다.
  if (await canFastPathExistingSave(request, env, slug)) return next();

  let body;
  try {
    body = await request.clone().json();
  } catch {
    return next();
  }

  const incoming = body?.page && typeof body.page === 'object' ? body.page : body;
  const project = projectFromRequest(new URL(request.url), body || {}, request);
  const saveIdentity = pageSaveIdentity(body || {}, incoming || {}, project, slug);
  const isCreationAttempt = saveIdentity.mode === 'create-new'
    || (saveIdentity.mode === 'legacy' && !saveIdentity.pageId);
  if (!isCreationAttempt) return next();

  const identity = await sessionIdentity(request, env);
  if (!identity?.ownerId || isPlatformMasterIdentity(identity, env)) return next();

  const db = assertD1(env);
  if (await ownedTargetExists(db, identity.ownerId, saveIdentity, slug)) return next();

  const currentPageCount = await activeOwnedPageCount(db, identity.ownerId);
  if (currentPageCount < GENERAL_ACCOUNT_PAGE_LIMIT) return next();

  return jsonResponse(request, env, 409, {
    ok: false,
    error: '일반 계정은 랜딩페이지를 1개까지만 만들 수 있습니다.',
    message: '일반 계정은 랜딩페이지를 1개까지만 만들 수 있습니다.',
    code: 'ACCOUNT_PAGE_LIMIT_REACHED',
    limit: GENERAL_ACCOUNT_PAGE_LIMIT,
    current: currentPageCount,
  }, METHODS);
}