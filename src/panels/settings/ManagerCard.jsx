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
        expanded={expanded}
        inviteUrl={inviteUrl}
        manager={manager}
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

          <div className="manager-detail-section">
            <ManagerPresetRow
              disabledManager={disabledManager}
              index={index}
              locked={locked}
              setManagerPreset={setManagerPreset}
            />
          </div>

          {menuExpanded && (
            <div className="manager-detail-section">
              <ManagerPermissionPanel
                disabledManager={disabledManager}
                index={index}
                locked={locked}
                manager={manager}
                managerPermissionMode={managerPermissionMode}
                setManagerPermissionMode={setManagerPermissionMode}
              />
            </div>
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
      )}
    </div>
  );
}
