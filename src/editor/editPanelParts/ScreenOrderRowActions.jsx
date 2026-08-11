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

  const menuItemStyle = {
    width: '100%',
    minHeight: 34,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '0 9px',
    border: 0,
    borderRadius: 7,
    background: 'transparent',
    color: 'var(--product-text)',
    fontSize: 11,
    fontWeight: 850,
    textAlign: 'left',
  };

  const quickActionStyle = {
    width: 28,
    minWidth: 28,
    height: 28,
    minHeight: 28,
    borderRadius: 7,
  };

  return (
    <div
      className="screen-row-actions"
      onClick={stop}
      style={{
        width: 92,
        minWidth: 92,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 28px)',
        alignItems: 'center',
        justifyContent: 'end',
        gap: 4,
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <IconAction
        onClick={onMoveUp}
        title={T.moveUp}
        aria-label={`${meta.label} ${T.moveUp}`}
        disabled={!canMoveUp}
        style={quickActionStyle}
      >
        <ArrowUp size={15} />
      </IconAction>
      <IconAction
        onClick={onMoveDown}
        title={T.moveDown}
        aria-label={`${meta.label} ${T.moveDown}`}
        disabled={!canMoveDown}
        style={quickActionStyle}
      >
        <ArrowDown size={15} />
      </IconAction>
      <IconAction
        onClick={() => setMenuOpen((open) => !open)}
        title="더보기"
        aria-label={`${meta.label} 더보기`}
        aria-expanded={menuOpen}
        style={quickActionStyle}
      >
        <MoreHorizontal size={16} />
      </IconAction>

      {menuOpen && (
        <div
          className="screen-row-more-menu"
          role="menu"
          style={{
            position: 'absolute',
            top: 34,
            right: 0,
            zIndex: 200,
            width: 118,
            display: 'grid',
            gap: 3,
            padding: 5,
            border: '1px solid var(--product-line)',
            borderRadius: 9,
            background: '#fff',
            boxShadow: '0 12px 30px rgba(17,24,39,.16)',
          }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={!canDuplicate}
            onClick={() => run(onDuplicate)}
            style={{ ...menuItemStyle, opacity: canDuplicate ? 1 : .4 }}
          >
            <Copy size={14} /> 복제
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onRemove)}
            style={{ ...menuItemStyle, color: 'var(--product-danger)' }}
          >
            <Trash2 size={14} /> 삭제
          </button>
        </div>
      )}
    </div>
  );
}
