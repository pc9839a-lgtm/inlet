import { useMemo, useState } from 'react';
import { normalizeManagerAccount } from '../../lib/authContext.js';
import { createManagerDraftHandlers } from './managerDraftHandlers.js';
import {
  managerPermissionMode,
  normalizeManagerDrafts,
} from './managerSettingsState.js';
import { createManagerInviteActions } from './managerInviteActions.js';
import { createManagerOwnershipActions } from './managerOwnershipActions.js';

export default function useManagerSettings({
  authUser,
  editSection,
  lockSection,
  managers,
  ownership,
  page,
  serverPage,
  updatePage,
}) {
  const [managerDraft, setManagerDraft] = useState(() => managers.map(normalizeManagerAccount));
  const eligibleTransferManagers = useMemo(() => managerDraft.filter((manager) => manager.email && manager.status === 'active'), [managerDraft]);
  const [transferManagerId, setTransferManagerId] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [expandedManagerId, setExpandedManagerId] = useState('');
  const [expandedManagerMenuId, setExpandedManagerMenuId] = useState('');
  const [inviteLoading, setInviteLoading] = useState('');

  const {
    addManager,
    disableManager,
    editManagers,
    removeManager,
    saveManagers,
    setManagerPermissionMode,
    setManagerPreset,
    updateManager,
    updateOwnership,
  } = createManagerDraftHandlers({
    editSection,
    lockSection,
    managerDraft,
    managers,
    ownership,
    page,
    setExpandedManagerId,
    setExpandedManagerMenuId,
    setManagerDraft,
    updatePage,
  });

  const { copyInvite, createInvite } = createManagerInviteActions({
    authUser,
    managerDraft,
    page,
    serverPage,
    setInviteLoading,
    updateManager,
    updateOwnership,
  });

  const { cancelOwnershipTransfer, requestOwnershipTransferPersisted } = createManagerOwnershipActions({
    authUser,
    eligibleTransferManagers,
    managerDraft,
    ownership,
    page,
    serverPage,
    setTransferManagerId,
    transferManagerId,
    updateOwnership,
  });

  return {
    addManager,
    cancelOwnershipTransfer,
    copyInvite,
    createInvite,
    disableManager,
    editManagers,
    eligibleTransferManagers,
    expandedManagerId,
    expandedManagerMenuId,
    inviteLoading,
    managerDraft,
    managerPermissionMode,
    removeManager,
    requestOwnershipTransferPersisted,
    saveManagers,
    setExpandedManagerId,
    setExpandedManagerMenuId,
    setManagerPermissionMode,
    setManagerPreset,
    setShowTransfer,
    setTransferManagerId,
    showTransfer,
    transferManagerId,
    updateManager,
  };
}
