import { MoreHorizontal } from 'lucide-react';
import { canDuplicateScreenOrderBlock } from './screenOrderActionPolicy.js';
import { ScreenOrderRowActionMenu } from './ScreenOrderRowActionMenu.jsx';
import { useScreenOrderRowMenu } from './useScreenOrderRowMenu.js';
import { T } from './editorLabels.js';
import { IconAction } from './editorControls.jsx';

export function ScreenOrderRowActions({
  block,
  meta,
  canMoveUp,
  canMoveDown,
  onOpenSettings,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
}) {
  const canDuplicate = canDuplicateScreenOrderBlock(block);
  const { menuOpen, runAction, toggleMenu, stop } = useScreenOrderRowMenu();

  return (
    <div className="screen-row-actions" onClick={stop}>
      <IconAction
        className="screen-more-action"
        onClick={toggleMenu}
        title={T.more}
        aria-label={`${meta.label} ${T.more}`}
        aria-expanded={menuOpen}
      >
        <MoreHorizontal size={16} />
      </IconAction>
      {menuOpen && (
        <ScreenOrderRowActionMenu
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          canDuplicate={canDuplicate}
          onAction={runAction}
          onOpenSettings={onOpenSettings}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}