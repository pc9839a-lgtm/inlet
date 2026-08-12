import React from 'react';
import { ScreenOrderItem } from './ScreenOrderItem.jsx';

export function ScreenOrderListItems({
  normalBlocks,
  selectedId,
  dragId,
  setDragId,
  selectBlock,
  openBlockSettings,
  toggleVisible,
  duplicateBlock,
  removeBlock,
  reorderToIndex,
  renderBlockEditor,
}) {
  const total = normalBlocks.length;

  return (
    <div className="screen-order-v2-list">
      {normalBlocks.map((block, index) => (
        <ScreenOrderItem
          key={block.id}
          block={block}
          index={index}
          total={total}
          selected={selectedId === block.id}
          dragId={dragId}
          setDragId={setDragId}
          selectBlock={selectBlock}
          openBlockSettings={openBlockSettings}
          toggleVisible={toggleVisible}
          duplicateBlock={duplicateBlock}
          removeBlock={removeBlock}
          reorderToIndex={reorderToIndex}
          renderBlockEditor={renderBlockEditor}
        />
      ))}
    </div>
  );
}
