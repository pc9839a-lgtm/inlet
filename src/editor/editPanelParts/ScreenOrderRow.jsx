import React from 'react';
import { ScreenOrderRowActions } from './ScreenOrderRowActions.jsx';
import { ScreenOrderRowIdentity } from './ScreenOrderRowIdentity.jsx';
import { createScreenOrderRowInteraction } from './screenOrderRowInteraction.js';
import { isExplicitlyHidden } from './screenOrderIdentityModel.js';

export function ScreenOrderRow({
  block,
  identity,
  index,
  meta,
  open,
  dragId,
  canMoveUp,
  canMoveDown,
  onSelectRow,
  onToggleVisible,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
  onDragStart,
  onDragEnd,
}) {
  const { selectRow, selectRowByKey } = createScreenOrderRowInteraction({ onSelectRow });
  const hidden = isExplicitlyHidden(block);

  return (
    <div
      id={`editor-block-${block.id}`}
      className={`screen-order-v2-item${open ? ' is-open' : ''}${hidden ? ' is-hidden' : ''}${dragId === block.id ? ' is-dragging' : ''}`}
      data-order={index + 1}
      data-block-type={block.type}
      data-selected={open ? 'true' : 'false'}
    >
      <div className="screen-order-v2-head" onClick={selectRow}>
        <ScreenOrderRowIdentity
          block={block}
          identity={identity}
          index={index}
          meta={meta}
          open={open}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onSelectRow={selectRow}
          onSelectRowByKey={selectRowByKey}
        />

        <ScreenOrderRowActions
          block={block}
          meta={meta}
          selected={open}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          onToggleVisible={onToggleVisible}
        />
      </div>

      {open && (
        <span hidden data-screen-order-selected-state="true" />
      )}
    </div>
  );
}
