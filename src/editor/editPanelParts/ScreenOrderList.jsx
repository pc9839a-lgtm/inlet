import React from 'react';
import './ScreenOrder.css';
import { ScreenOrderListItems } from './ScreenOrderListItems.jsx';
import { ScreenOrderSettings } from './ScreenOrderSettings.jsx';
import { createScreenOrderIdentities } from './screenOrderIdentityModel.js';
import { ScreenOrderRowActions } from './ScreenOrderRowActions.jsx';
import { META } from '../../config/blockMeta.jsx';
import { createScreenOrderMovement } from './screenOrderMovement.js';

export function ScreenOrderList(props) {
  // Preserve one real editor instance. Desktop inline editing renders the
  // same list rows plus their selected block editor, whereas compact/laptop
  // still use the independent Inspector below.
  if (props.listOnly || props.inlineEditing) return (
    <section className="screen-order-v2-card screen-order-v2-list-view" data-inline-stack={props.inlineEditing ? 'true' : 'false'}>
      <ScreenOrderListItems {...props} listOnly={!props.inlineEditing} />
    </section>
  );
  const selectedIndex = props.normalBlocks.findIndex((block) => block.id === props.selectedId);
  const selectedBlock = props.normalBlocks[selectedIndex];
  const movement = selectedBlock ? createScreenOrderMovement({ block: selectedBlock, index: selectedIndex, total: props.normalBlocks.length, reorderToIndex: props.reorderToIndex }) : null;
  const selectedIdentity = selectedBlock ? createScreenOrderIdentities(props.normalBlocks)[selectedIndex] : null;

  return (
    <section className="screen-order-v2-card">
      {selectedBlock && (
        <ScreenOrderSettings
          key={selectedBlock.id}
          block={selectedBlock}
          identity={selectedIdentity}
          navigation={props.inspectorNavigation}
          renderBlockEditor={props.renderBlockEditor}
          actions={<ScreenOrderRowActions block={selectedBlock} meta={META[selectedBlock.type] || META.text} selected instance="inspector"
            canMoveUp={selectedIndex > 0} canMoveDown={selectedIndex < props.normalBlocks.length - 1}
            onMoveUp={movement.moveUp}
            onMoveDown={movement.moveDown}
            onToggleVisible={() => props.toggleVisible(selectedBlock.id)}
            onDuplicate={() => props.duplicateBlock(selectedBlock.id)} onRemove={() => props.removeBlock(selectedBlock.id)} />}
        />
      )}
    </section>
  );
}
