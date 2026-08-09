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
      <div className="manager-subtitle">메뉴별 권한</div>
      <p className="manager-subcopy">민감한 설정 권한은 필요한 매니저에게만 부여하세요.</p>
      <div className="manager-permission-grid">
        {MANAGER_PERMISSION_TABS.map((permissionTab) => (
          <div className="manager-permission-row" key={permissionTab}>
            <div>
              <strong>{MANAGER_TAB_LABELS[permissionTab]}</strong>
              <small>{permissionTab === 'settings' ? '계정·결제·권한 등 설정 메뉴' : '해당 메뉴 접근 수준'}</small>
            </div>
            <select
              aria-label={`${MANAGER_TAB_LABELS[permissionTab]} 권한`}
              value={managerPermissionMode(manager, permissionTab)}
              disabled={locked || disabledManager}
              onChange={(event) => setManagerPermissionMode(index, permissionTab, event.target.value)}
            >
              <option value="none">권한 없음</option>
              <option value="read">보기만</option>
              <option value="write">보기·편집</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
