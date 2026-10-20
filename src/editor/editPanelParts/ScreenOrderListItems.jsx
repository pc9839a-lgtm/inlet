import React from 'react';
import { ScreenOrderItem } from './ScreenOrderItem.jsx';
import { createScreenOrderIdentities } from './screenOrderIdentityModel.js';

export function ScreenOrderListItems({
  normalBlocks,
  selectedId,
  dragId,
  setDragId,
  selectBlock,
  toggleVisible,
  duplicateBlock,
  removeBlock,
  reorderToIndex,
  renderBlockEditor,
}) {
  const total = normalBlocks.length;
  const rowIdentities = createScreenOrderIdentities(normalBlocks);
  // D05: removing a redundant auto-scroll keeps row clicks from moving the
  // document and fighting preview-to-editor navigation.

  return (
    <div className="screen-order-v2-list">
      {normalBlocks.map((block, index) => (
        <ScreenOrderItem
          key={block.id}
          block={block}
          identity={rowIdentities[index]}
          index={index}
          total={total}
          selected={selectedId === block.id}
          dragId={dragId}
          setDragId={setDragId}
          selectBlock={selectBlock}
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
