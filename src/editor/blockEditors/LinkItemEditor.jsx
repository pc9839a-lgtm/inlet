import { Danger, MiniDetail } from '../controls.jsx';
import { getLinkBadge, getLinkIcon } from './LinkItemDisplay.jsx';
import LinkItemFields from './LinkItemFields.jsx';

export default function LinkItemEditor({ item, page, TargetControl, onUpdate, onRemove }) {
  return (
    <MiniDetail icon={getLinkIcon(item)} title={item.label} badge={getLinkBadge(item)}>
      <LinkItemFields item={item} page={page} TargetControl={TargetControl} onUpdate={onUpdate} />
      <Danger onClick={onRemove} />
    </MiniDetail>
  );
}