import React from 'react';
import { ScreenOrderItem } from './ScreenOrderItem.jsx';
import { ScreenOrderSettings } from './ScreenOrderSettings.jsx';
import { createScreenOrderIdentities } from './screenOrderIdentityModel.js';

// The editor is one ordered stack. A selected block opens its real editor
// directly underneath its row; it does not open a second detached inspector.
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
  inspectorNavigation,
}) {
  const total = normalBlocks.length;
  const rowIdentities = createScreenOrderIdentities(normalBlocks);

  return (
    <div className="screen-order-v2-list" data-editor-stack="blocks">
      {normalBlocks.map((block, index) => (
        <React.Fragment key={block.id}>
          <ScreenOrderItem
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
          />
          {selectedId === block.id && typeof renderBlockEditor === 'function' && (
            <section className="editor-inspector-panel editor-inline-settings"
              role="region" aria-label="선택 항목 편집" tabIndex={0}>
              <div id="editor-selection-panel" className="edit-section-panel" data-editor-section="order">
                <ScreenOrderSettings
                  key={block.id}
                  block={block}
                  identity={rowIdentities[index]}
                  navigation={inspectorNavigation}
                  renderBlockEditor={renderBlockEditor}
                />
              </div>
            </section>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
