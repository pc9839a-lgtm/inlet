import { DEFAULT_MANAGER_ACCESS, normalizeManagerAccount } from '../../lib/authContext.js';
import { managerInviteUrl } from '../../lib/managerInvites.js';

export function createNewManager() {
  return normalizeManagerAccount({
    id: `manager-${Date.now()}`,
    name: '',
    email: '',
    status: 'active',
    invitedAt: new Date().toISOString(),
    access: DEFAULT_MANAGER_ACCESS,
  });
}

export function normalizeInvitePatch(invite = {}) {
  return {
    inviteToken: invite.token || '',
    inviteUrl: managerInviteUrl(invite.token),
    inviteStatus: invite.status || 'pending',
    invitedAt: invite.invitedAt || new Date().toISOString(),
    acceptedAt: invite.acceptedAt || '',
    expiresAt: invite.expiresAt || '',
  };
}

export function normalizeManagerDrafts(managers = []) {
  return managers.map(normalizeManagerAccount);
}

export function updateManagerAt(managers = [], index, patch) {
  return managers.map((manager, currentIndex) => (
    currentIndex === index ? normalizeManagerAccount({ ...manager, ...patch }) : manager
  ));
}

export function managerPermissionMode(manager, tab) {
  if (manager.access?.[tab]?.write) return 'write';
  if (manager.access?.[tab]?.read) return 'read';
  return 'none';
}

export function applyManagerPermissionMode(manager, tab, mode) {
  return normalizeManagerAccount({
    ...manager,
    access: {
      ...manager?.access,
      [tab]: {
        read: mode === 'read' || mode === 'write',
        write: mode === 'write',
      },
    },
  });
}

export function ownershipTransferPatch({ authUser, ownership, request, selected }) {
  return {
    clientEmail: selected.email,
    clientAccess: true,
    transferRequest: request || {
      status: 'requested',
      managerId: selected.id,
      managerName: selected.name || '',
      managerEmail: selected.email,
      requestedBy: authUser?.email || ownership.ownerEmail || '',
      requestedAt: new Date().toISOString(),
      billingPolicy: '기존 결제가 있으면 만료 또는 해지 후 소유권이전, 이후 새 소유자 카드 결제 가능',
      adminApprovalRequired: true,
    },
  };
}