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
      className={`block-item screen-order-item ${open ? 'open selected' : ''} ${!block.visible ? 'muted' : ''} ${dragId === block.id ? 'dragging' : ''}`}
      data-order={index + 1}
      data-selected={open ? 'true' : 'false'}
    >
      <div
        className="block-head screen-order-head"
        onClick={selectRow}
        style={{
          gridTemplateColumns: '34px minmax(0, 1fr) 42px 102px',
          overflow: 'visible',
        }}
      >
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
        <div className="screen-order-inline-editor" onClick={stop} onKeyDown={stop}>
          <SelectedBlockSettingsBody block={block} renderBlockEditor={renderBlockEditor} />
        </div>
      )}
    </div>
  );
}
