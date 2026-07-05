import { MANAGER_PERMISSION_TABS } from '../../lib/authContext.js';
import { MANAGER_TAB_LABELS } from './managerSettingsModel.js';

export default function ManagerPermissionPanel({
  disabledManager,
  index,
  locked,
  manager,
  managerPermissionMode,
  setManagerPermissionMode,
}) {
  return (
    <div className="manager-permission-panel">
      <div className="manager-subtitle">{'\uBA54\uB274 \uAD8C\uD55C'}</div>
      <div className="manager-permission-grid">
        {MANAGER_PERMISSION_TABS.map((permissionTab) => (
          <div className="manager-permission-row" key={permissionTab}>
            <strong>{MANAGER_TAB_LABELS[permissionTab]}</strong>
            <select value={managerPermissionMode(manager, permissionTab)} disabled={locked || disabledManager} onChange={(event) => setManagerPermissionMode(index, permissionTab, event.target.value)}>
              <option value="none">{'\uAD8C\uD55C \uC5C6\uC74C'}</option>
              <option value="read">{'\uBCF4\uAE30'}</option>
              <option value="write">{'\uD3B8\uC9D1'}</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
