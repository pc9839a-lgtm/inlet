import React from 'react';
import { ScreenOrderItem } from './ScreenOrderItem.jsx';
import { ScreenOrderSettings } from './ScreenOrderSettings.jsx';
import { createScreenOrderIdentities } from './screenOrderIdentityModel.js';
import { ScreenOrderRowActions } from './ScreenOrderRowActions.jsx';
import { createScreenOrderMovement } from './screenOrderMovement.js';
import { META } from '../../config/blockMeta.jsx';

// Desktop editing expands the original widget editor within its block row.
// Compact and laptop continue using their dedicated Inspector path.

export function ScreenOrderListItems({
  normalBlocks,
  selectedId,
  listOnly = false,
  dragId,
  setDragId,
  selectBlock,
  toggleVisible,
  duplicateBlock,
  removeBlock,
  reorderToIndex,
  renderBlockEditor,
  inspectorNavigation,
  onCollapseEditor,
}) {
  const total = normalBlocks.length;
  const rowIdentities = createScreenOrderIdentities(normalBlocks);

  return (
    <div className="screen-order-v2-list" data-editor-stack="blocks">
      {normalBlocks.map((block, index) => {
        const movement = createScreenOrderMovement({
          block, index, total, reorderToIndex,
        });
        return <React.Fragment key={block.id}>;
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
          {!listOnly && selectedId === block.id && typeof renderBlockEditor === 'function' && (
            <section className="editor-inspector-panel editor-inline-settings editor-inline-expanded"
              role="region" aria-label="선택 항목 편집" tabIndex={0}>
              <div className="editor-inline-expanded-heading">
                <span>블록 내용 수정</span>
                <button type="button" onClick={onCollapseEditor} aria-label="이 블록 편집 접기">접기</button>
              </div>
              <div id="editor-selection-panel" className="edit-section-panel" data-editor-section="order">
                <ScreenOrderSettings
                  key={block.id}
                  block={block}
                  identity={rowIdentities[index]}
                  navigation={inspectorNavigation}
                  renderBlockEditor={renderBlockEditor}
                  actions={<ScreenOrderRowActions
                    block={block}
                    meta={META[block.type] || META.text}
                    selected
                    instance="inspector"
                    canMoveUp={index > 0}
                    canMoveDown={index < total - 1}
                    onMoveUp={movement.moveUp}
                    onMoveDown={movement.moveDown}
                    onToggleVisible={() => toggleVisible(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onRemove={() => removeBlock(block.id)}
                  />}
                />
              </div>
            </section>
          )}
        </React.Fragment>;
      })}
    </div>
  );
}
