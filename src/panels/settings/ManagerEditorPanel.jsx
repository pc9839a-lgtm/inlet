import { managerInviteUrl } from '../../lib/managerInvites.js';
import ManagerDetailActions from './ManagerDetailActions.jsx';
import ManagerPermissionPanel from './ManagerPermissionPanel.jsx';
import ManagerPresetRow from './ManagerPresetRow.jsx';
import ManagerProfileFields from './ManagerProfileFields.jsx';

export default function ManagerEditorPanel({
  copyInvite,
  createInvite,
  disableManager,
  index,
  inviteLoading,
  locked,
  manager,
  managerPermissionMode,
  menuExpanded,
  removeManager,
  setExpandedManagerMenuId,
  setManagerPermissionMode,
  setManagerPreset,
  updateManager,
}) {
  if (!manager) return null;

  const loading = inviteLoading === (manager.id || manager.email || String(index));
  const inviteUrl = manager.inviteUrl || managerInviteUrl(manager.inviteToken);
  const disabledManager = manager.status !== 'active';

  return (
    <div className="manager-editor-panel">
      <ManagerProfileFields
        index={index}
        locked={locked}
        manager={manager}
        updateManager={updateManager}
      />

      <div className="manager-editor-role">
        <ManagerPresetRow
          disabledManager={disabledManager}
          index={index}
          locked={locked}
          manager={manager}
          setManagerPreset={setManagerPreset}
        />
      </div>

      {menuExpanded && (
        <ManagerPermissionPanel
          disabledManager={disabledManager}
          index={index}
          locked={locked}
          manager={manager}
          managerPermissionMode={managerPermissionMode}
          setManagerPermissionMode={setManagerPermissionMode}
        />
      )}

      <ManagerDetailActions
        createInvite={() => createInvite(manager, index)}
        copyInvite={() => copyInvite(manager)}
        disableManager={() => disableManager(index)}
        disabledManager={disabledManager}
        inviteUrl={inviteUrl}
        loading={loading}
        locked={locked}
        menuExpanded={menuExpanded}
        removeManager={() => removeManager(index)}
        toggleMenu={() => setExpandedManagerMenuId(menuExpanded ? '' : manager.id)}
      />
    </div>
  );
}
