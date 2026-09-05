import { getD1ProjectAccess, listD1OwnershipTransferRequests, listD1ProjectMembers, upsertD1OwnershipTransferRequest, upsertD1ProjectMember } from '../../../server/storage/d1Adapter.mjs';
import { ownerIdForEmail, normalizeEmail } from '../auth/_auth.js';

export const OWNERSHIP_METHODS = 'GET, POST, OPTIONS';
export const TRANSFER_STATUSES = ['requested', 'waiting_billing_clearance', 'approved', 'rejected', 'completed', 'canceled'];
export const BILLING_STATUSES = ['not_checked', 'clear', 'active_subscription', 'past_due'];

export function ownershipError(message, status = 400, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

export function normalizeTransferStatus(value = '') {
  const status = String(value || '').trim();
  return TRANSFER_STATUSES.includes(status) ? status : '';
}

export function normalizeBillingStatus(value = '') {
  const status = String(value || '').trim();
  return BILLING_STATUSES.includes(status) ? status : '';
}

export function publicOwnershipTransferRequest(request = {}, manager = {}) {
  return {
    id: request.id || '',
    projectId: request.projectId || '',
    managerId: manager.id || request.managerId || request.toAccountId || '',
    managerName: manager.name || request.managerName || '',
    managerEmail: manager.email || request.managerEmail || '',
    fromAccountId: request.fromAccountId || '',
    toAccountId: request.toAccountId || '',
    requestedByAccountId: request.requestedByAccountId || '',
    approvedByAccountId: request.approvedByAccountId || '',
    status: request.status || 'requested',
    billingClearanceStatus: request.billingClearanceStatus || 'not_checked',
    note: request.note || '',
    requestedAt: request.requestedAt || '',
    approvedAt: request.approvedAt || '',
    completedAt: request.completedAt || '',
    billingPolicy: '결제가 진행 중이면 만료 또는 해지 후 최종 승인됩니다. 이후 새 소유자 계정의 결제수단으로 결제할 수 있게 연결합니다.',
  };
}

export async function createD1OwnershipTransferRequest(db, project = {}, input = {}, identity = {}) {
  const projectId = String(project.projectId || project.id || '').trim();
  if (!projectId) throw ownershipError('projectId is required.', 400, { code: 'PROJECT_ID_REQUIRED' });
  const access = await getD1ProjectAccess(db, { projectId });
  if (!access) throw ownershipError('Project access metadata is required before ownership transfer.', 403, { code: 'PROJECT_ACCESS_REQUIRED' });
  const actorOwnerId = String(identity.ownerId || '').trim();
  if (!actorOwnerId) {
    throw ownershipError('Signed project owner session is required.', 401, { code: 'AUTH_SIGNED_SESSION_REQUIRED' });
  }
  if (actorOwnerId !== String(access.ownerId || '').trim()) {
    throw ownershipError('Only the project owner can request ownership transfer.', 403, { code: 'PROJECT_OWNER_REQUIRED' });
  }

  const managerEmail = normalizeEmail(input.managerEmail || input.email || '');
  const managerId = String(input.managerId || input.targetManagerId || '').trim();
  const targetOwnerId = managerId || ownerIdForEmail(managerEmail);
  const members = await listD1ProjectMembers(db, { projectId });
  const selected = members.find((member) => member.role === 'manager' && member.status === 'active' && member.ownerId === targetOwnerId);
  if (!selected?.ownerId) throw ownershipError('Ownership transfer target must be an active manager.', 400, { code: 'OWNERSHIP_TRANSFER_MANAGER_REQUIRED' });

  const now = new Date().toISOString();
  const request = {
    id: String(input.id || `transfer-${Date.now()}-${crypto.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10)}`),
    projectId,
    managerId: selected.id || selected.ownerId,
    managerName: String(input.managerName || input.name || '').trim(),
    managerEmail,
    fromAccountId: access.ownerId,
    toAccountId: selected.ownerId,
    requestedByAccountId: identity.ownerId || access.ownerId,
    status: 'requested',
    billingClearanceStatus: 'not_checked',
    note: String(input.note || '').trim(),
    requestedAt: now,
  };
  const saved = await upsertD1OwnershipTransferRequest(db, request, {
    projectId,
    fromAccountId: request.fromAccountId,
    toAccountId: request.toAccountId,
    requestedByAccountId: request.requestedByAccountId,
  });
  return publicOwnershipTransferRequest(saved, { ...selected, email: managerEmail, name: request.managerName });
}

export async function listD1OwnershipTransfers(db, project = {}, filters = {}) {
  const projectId = String(project.projectId || project.id || '').trim();
  if (!projectId) throw ownershipError('projectId is required.', 400, { code: 'PROJECT_ID_REQUIRED' });
  const page = await listD1OwnershipTransferRequests(db, {
    projectId,
    status: filters.status || '',
    cursor: filters.cursor || 0,
    limit: filters.limit || 50,
  });
  return {
    requests: page.records.map((request) => publicOwnershipTransferRequest(request)),
    total: page.total,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    queryPlan: {
      adapter: 'd1',
      indexed: true,
      fullScan: false,
      endpoint: '/api/projects/ownership-transfer',
    },
  };
}

export async function updateD1OwnershipTransferRequest(db, project = {}, id = '', input = {}, identity = {}) {
  const projectId = String(project.projectId || project.id || '').trim();
  const requestId = String(id || '').trim();
  const status = normalizeTransferStatus(input.status || input.request?.status || '');
  if (!projectId || !requestId || !status || status === 'requested') {
    throw ownershipError('Valid ownership transfer status is required.', 400, { code: 'OWNERSHIP_TRANSFER_STATUS_REQUIRED' });
  }
  const page = await listD1OwnershipTransferRequests(db, { projectId, limit: 100 });
  const current = page.records.find((request) => request.id === requestId);
  if (!current) throw ownershipError('Ownership transfer request not found.', 404, { code: 'OWNERSHIP_TRANSFER_NOT_FOUND' });

  const billingInput = normalizeBillingStatus(input.billingClearanceStatus || input.billing_clearance_status || '');
  const billingClearanceStatus = billingInput || current.billingClearanceStatus || (status === 'waiting_billing_clearance' ? 'active_subscription' : 'not_checked');
  if (status === 'completed' && billingClearanceStatus !== 'clear') {
    throw ownershipError('Ownership transfer cannot complete until billing is clear.', 409, { code: 'OWNERSHIP_TRANSFER_BILLING_NOT_CLEAR' });
  }
  const now = new Date().toISOString();
  const saved = await upsertD1OwnershipTransferRequest(db, {
    ...current,
    status,
    billingClearanceStatus,
    note: String(input.note || current.note || ''),
    approvedByAccountId: identity.ownerId || current.approvedByAccountId || '',
    approvedAt: ['approved', 'rejected', 'waiting_billing_clearance'].includes(status) ? now : current.approvedAt,
    completedAt: status === 'completed' ? now : current.completedAt,
  }, {
    projectId,
    fromAccountId: current.fromAccountId,
    toAccountId: current.toAccountId,
    requestedByAccountId: current.requestedByAccountId,
  });
  if (status === 'completed') await completeD1OwnershipTransfer(db, projectId, saved, now);
  return publicOwnershipTransferRequest(saved);
}

async function completeD1OwnershipTransfer(db, projectId, request = {}, now = new Date().toISOString()) {
  const toAccountId = String(request.toAccountId || '').trim();
  const fromAccountId = String(request.fromAccountId || '').trim();
  if (!toAccountId) throw ownershipError('Ownership transfer target account is missing.', 400, { code: 'OWNERSHIP_TRANSFER_TARGET_REQUIRED' });
  await db.prepare(`
    UPDATE projects
    SET owner_account_id = ?, client_email = '', billing_status = CASE
      WHEN billing_status = 'transfer_pending' THEN 'trial'
      ELSE billing_status
    END, updated_at = ?
    WHERE id = ?
  `).bind(toAccountId, now, projectId).run();
  await upsertD1ProjectMember(db, {
    id: `${projectId}-${toAccountId}-master`,
    ownerId: toAccountId,
    role: 'master',
    access: {},
    status: 'active',
    acceptedAt: now,
    updatedAt: now,
  }, {
    projectId,
    accountId: toAccountId,
    invitedByAccountId: fromAccountId || null,
  });
  if (fromAccountId && fromAccountId !== toAccountId) {
    await db.prepare(`
      UPDATE project_members
      SET status = 'removed', updated_at = ?
      WHERE project_id = ? AND account_id = ? AND role IN ('master', 'client_admin')
    `).bind(now, projectId, fromAccountId).run();
  }
  await db.prepare(`
    UPDATE project_members
    SET status = 'removed', updated_at = ?
    WHERE project_id = ? AND account_id = ? AND role = 'manager'
  `).bind(now, projectId, toAccountId).run();
}
