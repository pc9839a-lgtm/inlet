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
  openSection,
  ownership,
  removeManager,
  requestOwnershipTransferPersisted,
  setExpandedManagerId,
  setExpandedManagerMenuId,
  setManagerPermissionMode,
  setManagerPreset,
  setOpenSection,
  setShowTransfer,
  setTransferManagerId,
  showTransfer,
  transferManagerId,
  transferRequest,
  updateManager,
}) {
  return (
    <SettingsSection id="managers" title="매니저 권한" description="초대와 메뉴 권한" badge={`${managerDraft.length}명`} openSection={openSection} setOpenSection={setOpenSection} locked={locked} onSave={onSave} onEdit={editManagers} className="manager-access-card">
      <div className="manager-section-tools">
        <div>
          <p>매니저별로 필요한 메뉴만 열어줍니다.</p>
        </div>
        <button type="button" disabled={locked} onClick={addManager}>매니저 추가</button>
      </div>

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
    </SettingsSection>
  );
}