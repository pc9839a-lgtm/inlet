import {
  managerAccessSummary,
  managerInviteState,
  managerLabel,
} from './managerSettingsModel.js';

export default function ManagerCardHeader({
  disabledManager,
  expanded,
  inviteUrl,
  manager,
  toggleExpanded,
}) {
  const stateLabel = disabledManager ? '비활성' : '활성';
  const email = manager.email || '이메일 필요';
  const inviteState = managerInviteState(manager, inviteUrl);

  return (
    <div className="manager-card-head manager-row-head">
      <div className="manager-row-identity">
        <strong>{managerLabel(manager)}</strong>
        <span>{email}</span>
      </div>
      <div className="manager-row-role">
        <strong>{managerAccessSummary(manager)}</strong>
      </div>
      <div className="manager-row-status">
        <span className={['manager-state-pill', disabledManager ? 'off' : 'on'].join(' ')}>{stateLabel}</span>
        {inviteState && <span className="manager-state-pill neutral">{inviteState}</span>}
      </div>
      <button type="button" className="settings-secondary-button compact" onClick={toggleExpanded}>
        {expanded ? '닫기' : '관리'}
      </button>
    </div>
  );
}
