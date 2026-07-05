import React from 'react';
import { createScreenOrderRowMenuItems } from './screenOrderRowMenuItems.js';

export function ScreenOrderRowActionMenu({
  canMoveUp,
  canMoveDown,
  canDuplicate,
  onAction,
  onOpenSettings,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
}) {
  const items = createScreenOrderRowMenuItems({
    canMoveUp,
    canMoveDown,
    canDuplicate,
    onOpenSettings,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    onRemove,
  });

  return (
    <div className="screen-row-action-menu" role="menu">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={item.danger ? 'danger' : undefined}
          onClick={onAction(item.handler)}
          disabled={item.disabled}
          role="menuitem"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}