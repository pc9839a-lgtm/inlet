import { managerInviteUrl } from '../../lib/managerInvites.js';
import ManagerCardHeader from './ManagerCardHeader.jsx';
import ManagerDetailActions from './ManagerDetailActions.jsx';
import ManagerPermissionPanel from './ManagerPermissionPanel.jsx';
import ManagerPresetRow from './ManagerPresetRow.jsx';
import ManagerProfileFields from './ManagerProfileFields.jsx';

export default function ManagerCard({
  copyInvite,
  createInvite,
  disableManager,
  expanded,
  index,
  inviteLoading,
  locked,
  manager,
  managerPermissionMode,
  menuExpanded,
  removeManager,
  setExpandedManagerId,
  setExpandedManagerMenuId,
  setManagerPermissionMode,
  setManagerPreset,
  updateManager,
}) {
  const loading = inviteLoading === (manager.id || manager.email || String(index));
  const inviteUrl = manager.inviteUrl || managerInviteUrl(manager.inviteToken);
  const disabledManager = manager.status !== 'active';

  return (
    <div className={['manager-card compact', disabledManager ? 'disabled' : ''].filter(Boolean).join(' ')}>
      <ManagerCardHeader
        disabledManager={disabledManager}
        disableManager={() => disableManager(index)}
        expanded={expanded}
        inviteUrl={inviteUrl}
        locked={locked}
        manager={manager}
        removeManager={() => removeManager(index)}
        toggleExpanded={() => setExpandedManagerId(expanded ? '' : manager.id)}
      />
      {expanded && (
        <div className="manager-card-body">
          <ManagerProfileFields
            index={index}
            locked={locked}
            manager={manager}
            updateManager={updateManager}
          />
          <ManagerPresetRow
            disabledManager={disabledManager}
            index={index}
            locked={locked}
            setManagerPreset={setManagerPreset}
          />
          <ManagerDetailActions
            createInvite={() => createInvite(manager, index)}
            copyInvite={() => copyInvite(manager)}
            disabledManager={disabledManager}
            inviteUrl={inviteUrl}
            loading={loading}
            locked={locked}
            menuExpanded={menuExpanded}
            toggleMenu={() => setExpandedManagerMenuId(menuExpanded ? '' : manager.id)}
          />
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
        </div>
      )}
    </div>
  );
}
