import { assertD1, authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson } from '../_shared.js';
import { writeAuditLog } from '../_audit.js';
import { createD1OwnershipTransferRequest, listD1OwnershipTransfers, OWNERSHIP_METHODS } from './_ownership.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, OWNERSHIP_METHODS);
  if (request.method !== 'GET' && request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, OWNERSHIP_METHODS);
  try {
    const db = assertD1(env);
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await readJson(request) : {};
    const project = projectFromRequest(url, body, request);
    const { identity } = await authorizeProject(request, env, project, { write: request.method === 'POST', tab: 'settings', masterOnly: request.method === 'POST', requireSignedSession: true });
    if (request.method === 'GET') {
      const result = await listD1OwnershipTransfers(db, project, {
        status: url.searchParams.get('status') || '',
        cursor: url.searchParams.get('cursor') || 0,
        limit: url.searchParams.get('limit') || 50,
      });
      return jsonResponse(request, env, 200, { ok: true, ...result }, OWNERSHIP_METHODS);
    }
    const transfer = body.transfer || body.request || {};
    const created = await createD1OwnershipTransferRequest(db, project, transfer, identity || {});
    await writeAuditLog({
      request,
      env,
      identity,
      projectId: project.projectId || project.id || created.projectId || '',
      action: 'ownership_transfer.requested',
      targetType: 'ownership_transfer',
      targetId: created.id || '',
      metadata: {
        status: created.status || 'requested',
        billingClearanceStatus: created.billingClearanceStatus || 'not_checked',
        fromAccountId: created.fromAccountId || '',
        toAccountId: created.toAccountId || '',
      },
    });
    return jsonResponse(request, env, 200, { ok: true, request: created }, OWNERSHIP_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, OWNERSHIP_METHODS);
  }
}
