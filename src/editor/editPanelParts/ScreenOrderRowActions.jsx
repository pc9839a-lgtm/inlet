import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { canDuplicateScreenOrderBlock } from './screenOrderActionPolicy.js';
import { T } from './editorLabels.js';
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

  const toggleMenu = (event) => {
    stop(event);
    setMenuOpen((open) => !open);
  };

  return (
    <div className="screen-order-v2-actions" onClick={stop}>
      <button
        type="button"
        className="screen-order-v2-action"
        onClick={onMoveUp}
        title={T.moveUp}
        aria-label={`${meta.label} ${T.moveUp}`}
        disabled={!canMoveUp}
      >
        <ArrowUp size={15} />
      </button>
      <button
        type="button"
        className="screen-order-v2-action"
        onClick={onMoveDown}
        title={T.moveDown}
        aria-label={`${meta.label} ${T.moveDown}`}
        disabled={!canMoveDown}
      >
        <ArrowDown size={15} />
      </button>
      <button
        type="button"
        className="screen-order-v2-action"
        onClick={toggleMenu}
        title="더보기"
        aria-label={`${meta.label} 더보기`}
        aria-expanded={menuOpen}
      >
        <MoreHorizontal size={16} />
      </button>

      {menuOpen && (
        <div className="screen-order-v2-menu" role="menu" onClick={stop}>
          <button type="button" role="menuitem" disabled={!canDuplicate} onClick={() => run(onDuplicate)}>
            <Copy size={14} /> 복제
          </button>
          <button type="button" role="menuitem" className="danger" onClick={() => run(onRemove)}>
            <Trash2 size={14} /> 삭제
          </button>
        </div>
      )}
    </div>
  );
}
