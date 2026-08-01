import { getD1ProjectById } from '../../../../../server/storage/d1Adapter.mjs';
import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../../_shared.js';
import { writeAuditLog } from '../../../_audit.js';
import { requirePlatformMaster } from '../../_auth.js';

const METHODS = 'POST, PATCH, OPTIONS';
const ACTIONS = new Set(['pause', 'restore', 'archive']);

function projectStatusError(message, status = 400, code = 'PROJECT_STATUS_INVALID') {
  const error = new Error(message);
  error.status = status;
  error.details = { code };
  return error;
}

export function normalizedProjectStatusAction(input = {}) {
  const action = String(input.action || '').trim().toLowerCase();
  if (ACTIONS.has(action)) return action;
  const status = String(input.status || '').trim().toLowerCase();
  if (status === 'active') return 'restore';
  if (status === 'paused') return 'pause';
  if (status === 'archived') return 'archive';
  return '';
}

export function projectActionState(action = '') {
  if (action === 'restore') return { dbStatus: 'active', auditAction: 'project.restored', operatorState: 'active' };
  if (action === 'archive') return { dbStatus: 'archived', auditAction: 'project.archived', operatorState: 'archived' };
  return { dbStatus: 'archived', auditAction: 'project.paused', operatorState: 'paused' };
}

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST' && request.method !== 'PATCH') {
    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    const identity = await requirePlatformMaster(request, env);
    const input = await readJson(request);
    const projectId = decodeURIComponent(String(params?.id || '')).trim();
    if (!projectId) throw projectStatusError('Project id is required.', 400, 'PROJECT_ID_REQUIRED');

    const project = await getD1ProjectById(db, projectId);
    if (!project?.projectId) throw projectStatusError('Project was not found.', 404, 'PROJECT_NOT_FOUND');

    const action = normalizedProjectStatusAction(input);
    if (!action) throw projectStatusError('Pause, restore, or archive action is required.');
    const state = projectActionState(action);
    const previousStatus = String(project.status || 'active').trim().toLowerCase() || 'active';
    const changed = previousStatus !== state.dbStatus;
    const updatedAt = new Date().toISOString();

    if (changed) {
      await db.prepare(`
        UPDATE projects
        SET status = ?, updated_at = ?
        WHERE id = ?
      `).bind(state.dbStatus, updatedAt, projectId).run();

      await writeAuditLog({
        request,
        env,
        identity,
        projectId,
        action: state.auditAction,
        targetType: 'project',
        targetId: projectId,
        metadata: {
          previousStatus,
          nextStatus: state.dbStatus,
          operatorState: state.operatorState,
          slug: project.slug || '',
          source: 'platform_master',
        },
      });
    }

    return jsonResponse(request, env, 200, {
      ok: true,
      changed,
      project: {
        id: projectId,
        projectId,
        slug: project.slug || '',
        title: project.title || project.slug || projectId,
        status: state.dbStatus,
        operatorState: state.operatorState,
        updatedAt: changed ? updatedAt : project.updatedAt || '',
      },
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
