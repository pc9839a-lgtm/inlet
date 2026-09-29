import React from 'react';
import { ScreenOrderItemDropTargets } from './ScreenOrderItemDropTargets.jsx';
import { ScreenOrderRow } from './ScreenOrderRow.jsx';
import { createScreenOrderItemModel } from './screenOrderItemModel.js';

export function ScreenOrderItem({
  block,
  index,
  total,
  selected,
  dragId,
  setDragId,
  selectBlock,
  toggleVisible,
  duplicateBlock,
  removeBlock,
  reorderToIndex,
  renderBlockEditor,
}) {
  const { meta, controls, isLast } = createScreenOrderItemModel({
    block,
    index,
    total,
    dragId,
    setDragId,
    reorderToIndex,
  });

  return (
    <ScreenOrderItemDropTargets controls={controls} isLast={isLast}>
      <ScreenOrderRow
        block={block}
        index={index}
        meta={meta}
        open={selected}
        dragId={dragId}
        canMoveUp={controls.canMoveUp}
        canMoveDown={controls.canMoveDown}
        onSelectRow={() => selectBlock(block.id)}
        onToggleVisible={() => toggleVisible(block.id)}
        onMoveUp={controls.moveUp}
        onMoveDown={controls.moveDown}
        onDuplicate={() => duplicateBlock(block.id)}
        onRemove={() => removeBlock(block.id)}
        onDragStart={controls.dragStart}
        onDragEnd={controls.dragEnd}
        renderBlockEditor={renderBlockEditor}
      />
      {selected && (
        <div
          className="screen-order-v2-inline-editor selected-block-settings-body block-editor"
          data-inline-block-editor="true"
        >
          {renderBlockEditor(block)}
        </div>
      )}
    </ScreenOrderItemDropTargets>
  );
}
