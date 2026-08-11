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
    <div className={['manager-card compact', disabledManager ? 'disabled' : '', expanded ? 'selected' : ''].filter(Boolean).join(' ')}>
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
