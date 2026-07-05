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
  return (
    <div className="manager-list">
      {managerDraft.length === 0 && <ManagerEmptyState addManager={addManager} locked={locked} />}
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