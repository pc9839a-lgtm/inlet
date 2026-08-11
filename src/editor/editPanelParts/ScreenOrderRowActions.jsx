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
    minHeight: 36,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 10px',
    border: 0,
    borderRadius: 7,
    background: 'transparent',
    color: 'var(--product-text)',
    fontSize: 11,
    fontWeight: 850,
    textAlign: 'left',
  };

  return (
    <div
      className="screen-row-actions"
      onClick={stop}
      style={{
        width: 36,
        minWidth: 36,
        display: 'block',
        position: 'relative',
        justifySelf: 'end',
        overflow: 'visible',
      }}
    >
      <IconAction
        onClick={() => setMenuOpen((open) => !open)}
        title="화면 순서 메뉴"
        aria-label={`${meta.label} 화면 순서 메뉴`}
        aria-expanded={menuOpen}
        style={{ width: 36, minWidth: 36, height: 36, minHeight: 36 }}
      >
        <MoreHorizontal size={18} />
      </IconAction>

      {menuOpen && (
        <div
          className="screen-row-more-menu"
          role="menu"
          style={{
            position: 'absolute',
            top: 40,
            right: 0,
            zIndex: 200,
            width: 142,
            display: 'grid',
            gap: 3,
            padding: 5,
            border: '1px solid var(--product-line)',
            borderRadius: 9,
            background: '#fff',
            boxShadow: '0 12px 30px rgba(17,24,39,.16)',
          }}
        >
          <button type="button" role="menuitem" disabled={!canMoveUp} onClick={() => run(onMoveUp)} style={{ ...menuItemStyle, opacity: canMoveUp ? 1 : .4 }}>
            <ArrowUp size={14} /> {T.moveUp}
          </button>
          <button type="button" role="menuitem" disabled={!canMoveDown} onClick={() => run(onMoveDown)} style={{ ...menuItemStyle, opacity: canMoveDown ? 1 : .4 }}>
            <ArrowDown size={14} /> {T.moveDown}
          </button>
          <button type="button" role="menuitem" disabled={!canDuplicate} onClick={() => run(onDuplicate)} style={{ ...menuItemStyle, opacity: canDuplicate ? 1 : .4 }}>
            <Copy size={14} /> 복제
          </button>
          <button type="button" role="menuitem" onClick={() => run(onRemove)} style={{ ...menuItemStyle, color: 'var(--product-danger)' }}>
            <Trash2 size={14} /> 삭제
          </button>
        </div>
      )}
    </div>
  );
}
