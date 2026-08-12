import React from 'react';
import { ScreenOrderRowActions } from './ScreenOrderRowActions.jsx';
import { ScreenOrderRowIdentity } from './ScreenOrderRowIdentity.jsx';
import { ScreenOrderRowVisibility } from './ScreenOrderRowVisibility.jsx';
import { createScreenOrderRowInteraction } from './screenOrderRowInteraction.js';
import { SelectedBlockSettingsBody } from './SelectedBlockSettingsBody.jsx';
import { stop } from './editorEvents.js';

export function ScreenOrderRow({
  block,
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
  renderBlockEditor,
}) {
  const { selectRow, selectRowByKey } = createScreenOrderRowInteraction({ onSelectRow });

  return (
    <div
      id={`editor-block-${block.id}`}
      className={`screen-order-v2-item${open ? ' is-open' : ''}${!block.visible ? ' is-hidden' : ''}${dragId === block.id ? ' is-dragging' : ''}`}
      data-order={index + 1}
      data-selected={open ? 'true' : 'false'}
    >
      <div className="screen-order-v2-head" onClick={selectRow}>
        <ScreenOrderRowIdentity
          block={block}
          index={index}
          meta={meta}
          open={open}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onSelectRow={selectRow}
          onSelectRowByKey={selectRowByKey}
        />

        <ScreenOrderRowVisibility visible={block.visible} onToggleVisible={onToggleVisible} />

        <ScreenOrderRowActions
          block={block}
          meta={meta}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      </div>

      {open && (
        <div className="screen-order-v2-inline-editor" onClick={stop} onKeyDown={stop}>
          <SelectedBlockSettingsBody block={block} renderBlockEditor={renderBlockEditor} />
        </div>
      )}
    </div>
  );
}
