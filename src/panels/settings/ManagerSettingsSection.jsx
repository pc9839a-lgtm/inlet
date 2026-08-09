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
      badge={`${managerDraft.length}명`}
      locked={locked}
      onSave={onSave}
      onEdit={editManagers}
      actionNote="매니저 역할과 메뉴 권한 변경사항을 저장합니다."
      className="manager-access-card"
    >
      <div className="settings-stack">
        <section className="settings-surface manager-list-surface">
          <header className="settings-surface-head">
            <div>
              <strong>매니저</strong>
              <small>역할 프리셋을 먼저 선택하고 필요한 메뉴 권한만 세부 조정합니다.</small>
            </div>
            <button type="button" className="settings-primary-button" disabled={locked} onClick={addManager}>매니저 추가</button>
          </header>

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
        </section>

        <section className="settings-surface manager-ownership-surface">
          <header className="settings-surface-head simple">
            <div>
              <strong>소유권</strong>
              <small>마스터 계정과 클라이언트 계정을 확인하고 필요한 경우 소유권 이전을 요청합니다.</small>
            </div>
          </header>
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
        </section>
      </div>
    </SettingsSection>
  );
}