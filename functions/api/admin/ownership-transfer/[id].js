import { assertD1, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson } from '../../_shared.js';
import { writeAuditLog } from '../../_audit.js';
import { requirePlatformMaster } from '../_auth.js';
import { listD1OwnershipTransfers, OWNERSHIP_METHODS, updateD1OwnershipTransferRequest } from '../../projects/_ownership.js';

const STATUS_ACTIONS = {
  waiting_billing_clearance: 'ownership_transfer.waiting_billing_clearance',
  approved: 'ownership_transfer.approved',
  rejected: 'ownership_transfer.rejected',
  completed: 'ownership_transfer.completed',
  canceled: 'ownership_transfer.canceled',
};

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, OWNERSHIP_METHODS);
  if (request.method !== 'POST' && request.method !== 'PATCH') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, OWNERSHIP_METHODS);
  try {
    const db = assertD1(env);
    const body = await readJson(request);
    const project = projectFromRequest(new URL(request.url), body, request);
    const identity = await requirePlatformMaster(request, env);
    const requestId = decodeURIComponent(params.id || '');
    const beforePage = await listD1OwnershipTransfers(db, project, { limit: 100 });
    const previous = beforePage.requests.find((item) => item.id === requestId) || null;
    const updated = await updateD1OwnershipTransferRequest(db, project, requestId, body, identity || {});
    await writeAuditLog({
      request,
      env,
      identity,
      projectId: project.projectId || project.id || updated.projectId || '',
      action: STATUS_ACTIONS[updated.status] || 'ownership_transfer.status_changed',
      targetType: 'ownership_transfer',
      targetId: updated.id || requestId,
      metadata: {
        previousStatus: previous?.status || '',
        nextStatus: updated.status || '',
        previousBillingClearanceStatus: previous?.billingClearanceStatus || '',
        nextBillingClearanceStatus: updated.billingClearanceStatus || '',
        fromAccountId: updated.fromAccountId || '',
        toAccountId: updated.toAccountId || '',
      },
    });
    return jsonResponse(request, env, 200, { ok: true, request: updated }, OWNERSHIP_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, OWNERSHIP_METHODS);
  }
}
