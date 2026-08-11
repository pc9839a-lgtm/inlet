import ManagerCard from './ManagerCard.jsx';
import ManagerEditorPanel from './ManagerEditorPanel.jsx';
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
  const selectedIndex = managerDraft.findIndex((manager) => manager.id === expandedManagerId);
  const selectedManager = selectedIndex >= 0 ? managerDraft[selectedIndex] : null;

  return (
    <div className="manager-list-shell">
      <div className="manager-list">
        {managerDraft.length === 0 && <ManagerEmptyState addManager={addManager} locked={locked} />}
        {managerDraft.map((manager, index) => (
          <ManagerCard
            key={manager.id || index}
            expanded={expandedManagerId === manager.id}
            manager={manager}
            setExpandedManagerId={setExpandedManagerId}
          />
        ))}
      </div>

      {selectedManager && (
        <ManagerEditorPanel
          copyInvite={copyInvite}
          createInvite={createInvite}
          disableManager={disableManager}
          index={selectedIndex}
          inviteLoading={inviteLoading}
          locked={locked}
          manager={selectedManager}
          managerPermissionMode={managerPermissionMode}
          menuExpanded={expandedManagerMenuId === selectedManager.id}
          removeManager={removeManager}
          setExpandedManagerMenuId={setExpandedManagerMenuId}
          setManagerPermissionMode={setManagerPermissionMode}
          setManagerPreset={setManagerPreset}
          updateManager={updateManager}
        />
      )}
    </div>
  );
}
