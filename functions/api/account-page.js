import { decodeD1Page } from '../../server/storage/d1Adapter.mjs';
import { assertD1, handleApiError, jsonResponse, optionsResponse, sessionIdentity } from './_shared.js';

const METHODS = 'GET, OPTIONS';

function text(value = '') {
  return String(value || '').trim();
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    const identity = await sessionIdentity(request, env);
    if (!identity?.ownerId) {
      const error = new Error('Login is required.');
      error.status = 401;
      error.details = { code: 'AUTH_SESSION_INVALID' };
      throw error;
    }

    const url = new URL(request.url);
    const pageId = text(url.searchParams.get('pageId'));
    const projectId = text(url.searchParams.get('projectId'));
    const slug = text(url.searchParams.get('slug'));
    if (!pageId || !projectId || !slug) {
      const error = new Error('Exact page identity is required.');
      error.status = 400;
      error.details = { code: 'PAGE_SAVE_IDENTITY_REQUIRED' };
      throw error;
    }

    const row = await db.prepare(`
      SELECT pages.*
      FROM pages
      JOIN projects ON projects.id = pages.project_id
      WHERE pages.id = ?
        AND pages.project_id = ?
        AND pages.slug = ?
        AND COALESCE(projects.status, 'active') NOT IN ('archived', 'deleted')
        AND (
          projects.owner_account_id = ?
          OR EXISTS (
            SELECT 1
            FROM project_members
            WHERE project_members.project_id = projects.id
              AND project_members.account_id = ?
              AND project_members.status = 'active'
              AND project_members.role IN ('manager', 'client_admin')
          )
        )
      LIMIT 1
    `).bind(pageId, projectId, slug, identity.ownerId, identity.ownerId).first();

    if (!row) {
      return jsonResponse(request, env, 404, {
        ok: false,
        error: '선택한 페이지를 찾을 수 없습니다.',
        code: 'ACCOUNT_PAGE_NOT_FOUND',
      }, METHODS);
    }

    return jsonResponse(request, env, 200, {
      ok: true,
      page: decodeD1Page(row),
    }, METHODS, { cacheControl: 'no-store' });
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
