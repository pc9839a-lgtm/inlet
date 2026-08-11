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
    <div
      className="screen-row-actions"
      onClick={stop}
      style={{
        width: 102,
        minWidth: 102,
        gridTemplateColumns: 'repeat(3, 31px)',
        justifyContent: 'end',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <IconAction
        onClick={onMoveUp}
        title={T.moveUp}
        aria-label={`${meta.label} ${T.moveUp}`}
        disabled={!canMoveUp}
      >
        <ArrowUp size={16} />
      </IconAction>
      <IconAction
        onClick={onMoveDown}
        title={T.moveDown}
        aria-label={`${meta.label} ${T.moveDown}`}
        disabled={!canMoveDown}
      >
        <ArrowDown size={16} />
      </IconAction>
      <IconAction
        onClick={() => setMenuOpen((open) => !open)}
        title="더보기"
        aria-label={`${meta.label} 더보기`}
        aria-expanded={menuOpen}
      >
        <MoreHorizontal size={17} />
      </IconAction>

      {menuOpen && (
        <div
          className="screen-row-more-menu"
          role="menu"
          style={{
            position: 'absolute',
            top: 36,
            right: 0,
            zIndex: 80,
            width: 112,
            display: 'grid',
            gap: 4,
            padding: 5,
            border: '1px solid var(--product-line)',
            borderRadius: 9,
            background: '#fff',
            boxShadow: '0 10px 28px rgba(17,24,39,.14)',
          }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={!canDuplicate}
            onClick={() => run(onDuplicate)}
            style={{ minHeight: 34, display: 'flex', alignItems: 'center', gap: 7, padding: '0 9px', border: 0, borderRadius: 7, background: 'transparent', color: 'var(--product-text)', fontSize: 11, fontWeight: 850 }}
          >
            <Copy size={14} /> 복제
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onRemove)}
            style={{ minHeight: 34, display: 'flex', alignItems: 'center', gap: 7, padding: '0 9px', border: 0, borderRadius: 7, background: 'transparent', color: 'var(--product-danger)', fontSize: 11, fontWeight: 850 }}
          >
            <Trash2 size={14} /> 삭제
          </button>
        </div>
      )}
    </div>
  );
}
