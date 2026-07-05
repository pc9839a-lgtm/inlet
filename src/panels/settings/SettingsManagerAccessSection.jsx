import ManagerSettingsSection from './ManagerSettingsSection.jsx';

export default function SettingsManagerAccessSection({
  authUser,
  canManageProjectUsers,
  locked,
  managerSettings,
  openSection,
  ownership,
  setOpenSection,
  transferRequest,
}) {
  if (!canManageProjectUsers) return null;

  const {
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
  } = managerSettings;

  return (
    <ManagerSettingsSection
      addManager={addManager}
      authUser={authUser}
      cancelOwnershipTransfer={cancelOwnershipTransfer}
      copyInvite={copyInvite}
      createInvite={createInvite}
      disableManager={disableManager}
      editManagers={editManagers}
      eligibleTransferManagers={eligibleTransferManagers}
      expandedManagerId={expandedManagerId}
      expandedManagerMenuId={expandedManagerMenuId}
      inviteLoading={inviteLoading}
      locked={locked}
      managerDraft={managerDraft}
      managerPermissionMode={managerPermissionMode}
      onSave={saveManagers}
      openSection={openSection}
      ownership={ownership}
      removeManager={removeManager}
      requestOwnershipTransferPersisted={requestOwnershipTransferPersisted}
      setExpandedManagerId={setExpandedManagerId}
      setExpandedManagerMenuId={setExpandedManagerMenuId}
      setManagerPermissionMode={setManagerPermissionMode}
      setManagerPreset={setManagerPreset}
      setOpenSection={setOpenSection}
      setShowTransfer={setShowTransfer}
      setTransferManagerId={setTransferManagerId}
      showTransfer={showTransfer}
      transferManagerId={transferManagerId}
      transferRequest={transferRequest}
      updateManager={updateManager}
    />
  );
}
