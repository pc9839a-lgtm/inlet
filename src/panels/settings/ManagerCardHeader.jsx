import {
  managerAccessSummary,
  managerInviteState,
  managerLabel,
} from './managerSettingsModel.js';

export default function ManagerCardHeader({
  disabledManager,
  disableManager,
  expanded,
  inviteUrl,
  locked,
  manager,
  removeManager,
  toggleExpanded,
}) {
  const stateLabel = disabledManager ? '\uBE44\uD65C\uC131' : '\uD65C\uC131';
  const email = manager.email || '\uC774\uBA54\uC77C \uD544\uC694';

  return (
    <div className="manager-card-head">
      <div>
        <div className="manager-title-row">
          <strong>{managerLabel(manager)}</strong>
          <span className={['manager-state-pill', disabledManager ? 'off' : 'on'].join(' ')}>{stateLabel}</span>
          <span className="manager-state-pill neutral">{managerInviteState(manager, inviteUrl)}</span>
        </div>
        <span className="manager-card-summary">{email} ? {managerAccessSummary(manager)}</span>
      </div>
      <div className="manager-card-actions">
        <button type="button" onClick={toggleExpanded}>{expanded ? '\uB2EB\uAE30' : '\uAD00\uB9AC'}</button>
        {!disabledManager && <button type="button" disabled={locked} onClick={disableManager}>{'\uBE44\uD65C\uC131 \uCC98\uB9AC'}</button>}
        <button type="button" className="danger-btn" disabled={locked} onClick={removeManager}>{'\uC0AD\uC81C'}</button>
      </div>
    </div>
  );
}
