import { managerInviteUrl } from '../../lib/managerInvites.js';
import ManagerCardHeader from './ManagerCardHeader.jsx';

export default function ManagerCard({
  expanded,
  manager,
  setExpandedManagerId,
}) {
  const inviteUrl = manager.inviteUrl || managerInviteUrl(manager.inviteToken);
  const disabledManager = manager.status !== 'active';

  return (
    <div
      className={['manager-card', disabledManager ? 'disabled' : '', expanded ? 'selected' : ''].filter(Boolean).join(' ')}
      style={{
        width: '100%',
        minWidth: 0,
        height: 'auto',
        minHeight: 68,
        margin: 0,
        padding: 0,
        overflow: 'visible',
        border: expanded ? '1px solid #9db4f5' : '1px solid var(--product-line)',
        borderRadius: 10,
        background: expanded ? '#f5f8ff' : '#fff',
        boxShadow: expanded ? 'inset 3px 0 0 var(--product-accent)' : 'none',
      }}
    >
      <ManagerCardHeader
        disabledManager={disabledManager}
        expanded={expanded}
        inviteUrl={inviteUrl}
        manager={manager}
        toggleExpanded={() => setExpandedManagerId(expanded ? '' : manager.id)}
      />
    </div>
  );
}
