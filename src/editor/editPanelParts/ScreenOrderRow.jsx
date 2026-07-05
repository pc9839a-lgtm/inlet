import React from 'react';
import { ScreenOrderRowActions } from './ScreenOrderRowActions.jsx';
import { ScreenOrderRowIdentity } from './ScreenOrderRowIdentity.jsx';
import { ScreenOrderRowVisibility } from './ScreenOrderRowVisibility.jsx';
import { createScreenOrderRowInteraction } from './screenOrderRowInteraction.js';

export function ScreenOrderRow({
  block,
  index,
  meta,
  open,
  dragId,
  canMoveUp,
  canMoveDown,
  onSelectRow,
  onOpenSettings,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
  onDragStart,
  onDragEnd,
}) {
  const { selectRow, selectRowByKey } = createScreenOrderRowInteraction({ onSelectRow });

  return (
    <div
      id={`editor-block-${block.id}`}
      className={`block-item screen-order-item ${open ? 'open selected' : ''} ${!block.visible ? 'muted' : ''} ${dragId === block.id ? 'dragging' : ''}`}
      data-order={index + 1}
      aria-selected={open}
      data-selected={open ? 'true' : 'false'}
      role="button"
      tabIndex={0}
      onClick={selectRow}
      onKeyDown={selectRowByKey}
    >
      <div className="block-head screen-order-head">
        <ScreenOrderRowIdentity
          block={block}
          index={index}
          meta={meta}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />

        <ScreenOrderRowVisibility visible={block.visible} onToggleVisible={onToggleVisible} />

        <ScreenOrderRowActions
          block={block}
          meta={meta}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onOpenSettings={onOpenSettings}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}