import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../../_shared.js';
import { auditErrorMetadata, writeAuditLog } from '../../../_audit.js';
import { isPlatformMasterIdentity } from '../../../_platformMaster.js';
import { requirePlatformMaster } from '../../_auth.js';

const METHODS = 'PATCH, OPTIONS';
const ACTIONS = new Set(['suspend', 'restore']);

function statusError(message, status = 400, code = 'ACCOUNT_STATUS_INVALID') {
  const error = new Error(message);
  error.status = status;
  error.details = { code };
  return error;
}

function normalizedAction(input = {}) {
  const action = String(input.action || '').trim().toLowerCase();
  if (ACTIONS.has(action)) return action;
  const status = String(input.status || '').trim().toLowerCase();
  if (status === 'suspended') return 'suspend';
  if (status === 'active') return 'restore';
  return '';
}

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'PATCH') {
    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
  }

  let identity = null;
  let targetId = '';
  let requestedAction = '';
  try {
    const db = assertD1(env);
    identity = await requirePlatformMaster(request, env);
    const input = await readJson(request);
    targetId = decodeURIComponent(String(params?.id || '')).trim();
    requestedAction = normalizedAction(input);

    if (!targetId) throw statusError('Account id is required.', 400, 'ACCOUNT_ID_REQUIRED');
    if (!requestedAction) throw statusError('Suspend or restore action is required.');

    const account = await db.prepare(`
      SELECT id, email, name, status, created_at, updated_at
      FROM accounts
      WHERE id = ?
      LIMIT 1
    `).bind(targetId).first();
    if (!account?.id) throw statusError('Account was not found.', 404, 'AUTH_ACCOUNT_NOT_FOUND');
    if (String(identity.ownerId || '') === targetId) {
      throw statusError('You cannot change your own account status.', 409, 'ACCOUNT_SELF_STATUS_CHANGE_BLOCKED');
    }
    if (isPlatformMasterIdentity({ email: account.email || '' }, env)) {
      throw statusError('Platform master accounts cannot be changed here.', 409, 'PLATFORM_MASTER_STATUS_CHANGE_BLOCKED');
    }

    const previousStatus = String(account.status || 'active').trim().toLowerCase() || 'active';
    if (previousStatus === 'deleted_pending_retention') {
      throw statusError('Deleted-pending-retention accounts cannot be restored here.', 409, 'ACCOUNT_DELETION_STATE_LOCKED');
    }
    const nextStatus = requestedAction === 'suspend' ? 'suspended' : 'active';
    const changed = previousStatus !== nextStatus;
    const updatedAt = new Date().toISOString();

    if (changed) {
      await db.prepare(`
        UPDATE accounts
        SET status = ?, updated_at = ?
        WHERE id = ?
      `).bind(nextStatus, updatedAt, targetId).run();

      await writeAuditLog({
        request,
        env,
        identity,
        action: requestedAction === 'suspend' ? 'account.suspended_by_admin' : 'account.restored_by_admin',
        targetType: 'account',
        targetId,
        metadata: {
          previousStatus,
          nextStatus,
          source: 'platform_master',
        },
      });
    }

    return jsonResponse(request, env, 200, {
      ok: true,
      changed,
      account: {
        id: account.id,
        email: account.email || '',
        name: account.name || '',
        status: nextStatus,
        updatedAt: changed ? updatedAt : account.updated_at || '',
      },
    }, METHODS);
  } catch (error) {
    if (identity?.ownerId) {
      await writeAuditLog({
        request,
        env,
        identity,
        action: 'account.admin_status_change_failed',
        targetType: 'account',
        targetId,
        metadata: {
          requestedAction,
          ...auditErrorMetadata(error),
        },
      });
    }
    return handleApiError(request, env, error, METHODS);
  }
}
