import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { canDuplicateScreenOrderBlock } from './screenOrderActionPolicy.js';
import { T } from './editorLabels.js';
import { stop } from './editorEvents.js';

const MENU_WIDTH = 146;
const MENU_HEIGHT = 154;
const MENU_GAP = 4;
const VIEWPORT_GUTTER = 8;

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
  const [menuPosition, setMenuPosition] = useState(null);
  const triggerRef = useRef(null);
  const canDuplicate = canDuplicateScreenOrderBlock(block);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const belowTop = rect.bottom + MENU_GAP;
    const aboveTop = rect.top - MENU_HEIGHT - MENU_GAP;
    const fitsBelow = belowTop + MENU_HEIGHT <= viewportHeight - VIEWPORT_GUTTER;
    const fitsAbove = aboveTop >= VIEWPORT_GUTTER;
    const preferredTop = fitsBelow || !fitsAbove ? belowTop : aboveTop;
    const maxTop = Math.max(VIEWPORT_GUTTER, viewportHeight - MENU_HEIGHT - VIEWPORT_GUTTER);
    const maxLeft = Math.max(VIEWPORT_GUTTER, viewportWidth - MENU_WIDTH - VIEWPORT_GUTTER);

    setMenuPosition({
      top: Math.min(Math.max(VIEWPORT_GUTTER, preferredTop), maxTop),
      left: Math.min(Math.max(VIEWPORT_GUTTER, rect.right - MENU_WIDTH), maxLeft),
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuOpen, updateMenuPosition]);

  const run = (action) => {
    setMenuOpen(false);
    action?.();
  };

  const toggleMenu = (event) => {
    stop(event);
    if (!menuOpen) updateMenuPosition();
    setMenuOpen((open) => !open);
  };

  const menu = menuOpen && menuPosition && typeof document !== 'undefined' ? createPortal(
    <div
      className="screen-order-v2-menu"
      role="menu"
      onClick={stop}
      style={{
        position: 'fixed',
        top: menuPosition.top,
        left: menuPosition.left,
        right: 'auto',
        zIndex: 10000,
      }}
    >
      <button type="button" role="menuitem" disabled={!canMoveUp} onClick={() => run(onMoveUp)}>
        <ArrowUp size={14} /> {T.moveUp}
      </button>
      <button type="button" role="menuitem" disabled={!canMoveDown} onClick={() => run(onMoveDown)}>
        <ArrowDown size={14} /> {T.moveDown}
      </button>
      <div className="screen-order-v2-menu-divider" aria-hidden="true" />
      <button type="button" role="menuitem" disabled={!canDuplicate} onClick={() => run(onDuplicate)}>
        <Copy size={14} /> 복제
      </button>
      <button type="button" role="menuitem" className="danger" onClick={() => run(onRemove)}>
        <Trash2 size={14} /> 삭제
      </button>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="screen-order-v2-actions" onClick={stop}>
      <button
        ref={triggerRef}
        type="button"
        className="screen-order-v2-action screen-order-v2-more"
        onClick={toggleMenu}
        title="더보기"
        aria-label={`${meta.label} 더보기`}
        aria-expanded={menuOpen}
      >
        <MoreHorizontal size={17} />
      </button>

      {menu}
    </div>
  );
}
