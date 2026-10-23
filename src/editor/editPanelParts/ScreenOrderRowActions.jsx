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
const MENU_OPEN_EVENT = 'pagero:screen-order-menu-open';

export function ScreenOrderRowActions({
  block,
  meta,
  selected,
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
  const menuRef = useRef(null);
  const previousSelectedRef = useRef(selected);
  const canDuplicate = canDuplicateScreenOrderBlock(block);
  const menuId = `screen-order-actions-${block.id}`;

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

  useEffect(() => {
    if (previousSelectedRef.current !== selected) setMenuOpen(false);
    previousSelectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (!menuOpen || !menuPosition || typeof document === 'undefined') return undefined;

    const focusFirstAction = () => {
      menuRef.current?.querySelector?.('button:not([disabled])')?.focus?.({ preventScroll: true });
    };
    queueMicrotask(focusFirstAction);

    const isInsideMenu = (target) => (
      triggerRef.current?.contains(target) || menuRef.current?.contains(target)
    );
    const closeIfOutside = (event) => {
      if (isInsideMenu(event.target)) return;
      if (event.type === 'focusin') {
        // React and the portal can move focus during a keyboard activation.
        // Resolve the final active element after that focus transfer, while
        // still closing when the user really tabs outside the menu.
        queueMicrotask(() => {
          if (!isInsideMenu(document.activeElement)) setMenuOpen(false);
        });
        return;
      }
      setMenuOpen(false);
    };
    const closeOtherMenu = (event) => {
      if (event.detail !== menuId) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(false);
      queueMicrotask(() => {
        if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true });
      });
    };

    document.addEventListener('pointerdown', closeIfOutside, true);
    document.addEventListener('focusin', closeIfOutside, true);
    document.addEventListener(MENU_OPEN_EVENT, closeOtherMenu);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside, true);
      document.removeEventListener('focusin', closeIfOutside, true);
      document.removeEventListener(MENU_OPEN_EVENT, closeOtherMenu);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [menuOpen, menuPosition, menuId]);

  const run = (action, { removing = false } = {}) => {
    const row = triggerRef.current?.closest('.screen-order-v2-item');
    const nextRow = row?.parentElement?.nextElementSibling?.querySelector?.('.screen-order-v2-title-wrap')
      || row?.parentElement?.previousElementSibling?.querySelector?.('.screen-order-v2-title-wrap');
    setMenuOpen(false);
    action?.();
    if (typeof requestAnimationFrame !== 'function') return;
    requestAnimationFrame(() => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const focusTarget = removing
        ? (nextRow?.isConnected ? nextRow : document.querySelector('.screen-order-v2-title-wrap'))
        : triggerRef.current;
      focusTarget?.focus?.({ preventScroll: true });
    });
  };

  const toggleMenu = (event) => {
    stop(event);
    if (!menuOpen) {
      updateMenuPosition();
      document.dispatchEvent(new CustomEvent(MENU_OPEN_EVENT, { detail: menuId }));
    }
    setMenuOpen((open) => !open);
  };

  const toggleMenuByKey = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    // Explicit activation is needed by keyboard/CDP and avoids a duplicate
    // synthetic click following the keydown.
    event.preventDefault();
    toggleMenu(event);
  };

  const menu = menuOpen && menuPosition && typeof document !== 'undefined' ? createPortal(
    <div
      ref={menuRef}
      id={menuId}
      className="screen-order-v2-menu"
      role="group"
      aria-label={`${meta.label} 작업`}
      onClick={stop}
      style={{
        position: 'fixed',
        top: menuPosition.top,
        left: menuPosition.left,
        right: 'auto',
        zIndex: 10000,
      }}
    >
      <button type="button" disabled={!canMoveUp} onClick={() => run(onMoveUp)}>
        <ArrowUp size={14} /> {T.moveUp}
      </button>
      <button type="button" disabled={!canMoveDown} onClick={() => run(onMoveDown)}>
        <ArrowDown size={14} /> {T.moveDown}
      </button>
      <div className="screen-order-v2-menu-divider" aria-hidden="true" />
      <button type="button" disabled={!canDuplicate} onClick={() => run(onDuplicate)}>
        <Copy size={14} /> 복제
      </button>
      <button type="button" className="danger" onClick={() => run(onRemove, { removing: true })}>
        <Trash2 size={14} /> 삭제
      </button>
    </div>,
    triggerRef.current?.closest('dialog') || document.body,
  ) : null;

  return (
    <div className="screen-order-v2-actions" onClick={stop}>
      <button
        ref={triggerRef}
        type="button"
        className="screen-order-v2-action screen-order-v2-more"
        onClick={toggleMenu}
        onKeyDown={toggleMenuByKey}
        title="더보기"
        aria-label={`${meta.label} 더보기`}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
      >
        <MoreHorizontal size={17} aria-hidden="true" />
      </button>

      {menu}
    </div>
  );
}
