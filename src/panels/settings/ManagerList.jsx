import ManagerCard from './ManagerCard.jsx';
import ManagerEmptyState from './ManagerEmptyState.jsx';

export default function ManagerList({
  addManager,
  copyInvite,
  createInvite,
  disableManager,
  expandedManagerId,
  expandedManagerMenuId,
  inviteLoading,
  locked,
  managerDraft,
  managerPermissionMode,
  removeManager,
  setExpandedManagerId,
  setExpandedManagerMenuId,
  setManagerPermissionMode,
  setManagerPreset,
  updateManager,
}) {
  const hasManagers = managerDraft.length > 0;

  return (
    <div className="manager-list">
      {hasManagers && (
        <div className="manager-list-head" aria-hidden="true">
          <span>매니저</span>
          <span>권한</span>
          <span>상태</span>
          <span />
        </div>
      )}
      {!hasManagers && <ManagerEmptyState addManager={addManager} locked={locked} />}
      {managerDraft.map((manager, index) => (
        <ManagerCard
          key={manager.id || index}
          copyInvite={copyInvite}
          createInvite={createInvite}
          disableManager={disableManager}
          expanded={expandedManagerId === manager.id}
          index={index}
          inviteLoading={inviteLoading}
          locked={locked}
          manager={manager}
          managerPermissionMode={managerPermissionMode}
          menuExpanded={expandedManagerMenuId === manager.id}
          removeManager={removeManager}
          setExpandedManagerId={setExpandedManagerId}
          setExpandedManagerMenuId={setExpandedManagerMenuId}
          setManagerPermissionMode={setManagerPermissionMode}
          setManagerPreset={setManagerPreset}
          updateManager={updateManager}
        />
      ))}
    </div>
  );
}