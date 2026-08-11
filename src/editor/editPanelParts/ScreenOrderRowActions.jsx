import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { canDuplicateScreenOrderBlock } from './screenOrderActionPolicy.js';
import { T } from './editorLabels.js';
import { IconAction } from './editorControls.jsx';
import { stop } from './editorEvents.js';

export function ScreenOrderRowActions({
  block,
  meta,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const canDuplicate = canDuplicateScreenOrderBlock(block);

  const run = (action) => {
    setMenuOpen(false);
    action?.();
  };

  return (
    <div className="screen-row-actions" onClick={stop}>
      <IconAction
        className="screen-row-quick-action"
        onClick={onMoveUp}
        title={T.moveUp}
        aria-label={`${meta.label} ${T.moveUp}`}
        disabled={!canMoveUp}
      >
        <ArrowUp size={15} />
      </IconAction>
      <IconAction
        className="screen-row-quick-action"
        onClick={onMoveDown}
        title={T.moveDown}
        aria-label={`${meta.label} ${T.moveDown}`}
        disabled={!canMoveDown}
      >
        <ArrowDown size={15} />
      </IconAction>
      <IconAction
        className="screen-row-quick-action"
        onClick={() => setMenuOpen((open) => !open)}
        title="더보기"
        aria-label={`${meta.label} 더보기`}
        aria-expanded={menuOpen}
      >
        <MoreHorizontal size={16} />
      </IconAction>

      {menuOpen && (
        <div className="screen-row-more-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={!canDuplicate}
            onClick={() => run(onDuplicate)}
          >
            <Copy size={14} /> 복제
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => run(onRemove)}
          >
            <Trash2 size={14} /> 삭제
          </button>
        </div>
      )}
    </div>
  );
}
