import ManagerList from './ManagerList.jsx';
import ManagerOwnershipTransfer from './ManagerOwnershipTransfer.jsx';
import SettingsSection from './SettingsSection.jsx';

export default function ManagerSettingsSection({
  addManager,
  authUser,
  cancelOwnershipTransfer,
  copyInvite,
  createInvite,
  disableManager,
  editManagers,
  eligibleTransferManagers,
  expandedManagerId,
  expandedManagerMenuId,
  inviteLoading,
  locked,
  managerDraft,
  managerPermissionMode,
  onSave,
  ownership,
  removeManager,
  requestOwnershipTransferPersisted,
  setExpandedManagerId,
  setExpandedManagerMenuId,
  setManagerPermissionMode,
  setManagerPreset,
  setShowTransfer,
  setTransferManagerId,
  showTransfer,
  transferManagerId,
  transferRequest,
  updateManager,
}) {
  return (
    <SettingsSection
      id="managers"
      locked={locked}
      onSave={onSave}
      onEdit={editManagers}
      className="manager-access-card settings-flat-section"
    >
      <div className="settings-flat-block">
        <div className="settings-flat-block-head">
          <strong>매니저 <span className="settings-count">{managerDraft.length}</span></strong>
          <button type="button" className="settings-primary-button compact" disabled={locked} onClick={addManager}>추가</button>
        </div>
        <ManagerList
          addManager={addManager}
          copyInvite={copyInvite}
          createInvite={createInvite}
          disableManager={disableManager}
          expandedManagerId={expandedManagerId}
          expandedManagerMenuId={expandedManagerMenuId}
          inviteLoading={inviteLoading}
          locked={locked}
          managerDraft={managerDraft}
          managerPermissionMode={managerPermissionMode}
          removeManager={removeManager}
          setExpandedManagerId={setExpandedManagerId}
          setExpandedManagerMenuId={setExpandedManagerMenuId}
          setManagerPermissionMode={setManagerPermissionMode}
          setManagerPreset={setManagerPreset}
          updateManager={updateManager}
        />
      </div>

      <div className="settings-flat-block">
        <div className="settings-flat-block-head"><strong>소유권</strong></div>
        <ManagerOwnershipTransfer
          authUser={authUser}
          cancelOwnershipTransfer={cancelOwnershipTransfer}
          eligibleTransferManagers={eligibleTransferManagers}
          ownership={ownership}
          requestOwnershipTransferPersisted={requestOwnershipTransferPersisted}
          setShowTransfer={setShowTransfer}
          setTransferManagerId={setTransferManagerId}
          showTransfer={showTransfer}
          transferManagerId={transferManagerId}
          transferRequest={transferRequest}
        />
      </div>
    </SettingsSection>
  );
}
