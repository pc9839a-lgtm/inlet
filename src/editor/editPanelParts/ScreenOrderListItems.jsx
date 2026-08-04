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
  inlineEditor = true,
}) {
  const total = normalBlocks.length;

  return (
    <div className="block-list screen-order-list">
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
          inlineEditor={inlineEditor}
        />
      ))}
    </div>
  );
}
