import { assertD1, handleApiError, jsonResponse, optionsResponse, sessionIdentity } from './_shared.js';

const METHODS = 'GET, OPTIONS';

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

    const result = await db.prepare(`
      SELECT
        projects.id AS project_id,
        projects.owner_account_id,
        projects.plan,
        pages.id AS page_id,
        pages.slug,
        pages.title,
        pages.revision,
        pages.updated_at,
        (SELECT COUNT(*) FROM leads WHERE leads.project_id = projects.id) AS lead_count
      FROM projects
      JOIN pages ON pages.project_id = projects.id
      WHERE COALESCE(projects.status, 'active') NOT IN ('archived', 'deleted')
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
      ORDER BY pages.updated_at DESC, projects.updated_at DESC
      LIMIT 200
    `).bind(identity.ownerId, identity.ownerId).all();

    const pages = (result?.results || []).map((row) => ({
      id: row.page_id || '',
      projectId: row.project_id || '',
      ownerId: row.owner_account_id || '',
      slug: row.slug || '',
      title: row.title || '',
      revision: Number(row.revision || 0),
      leadCount: Number(row.lead_count || 0),
      plan: row.plan || 'free',
      updatedAt: row.updated_at || '',
    }));

    return jsonResponse(request, env, 200, { ok: true, pages }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}