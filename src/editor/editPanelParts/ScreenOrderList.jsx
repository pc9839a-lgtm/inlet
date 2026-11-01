import React from 'react';
import './ScreenOrder.css';
import { ScreenOrderListItems } from './ScreenOrderListItems.jsx';
import { ScreenOrderSettings } from './ScreenOrderSettings.jsx';
import { createScreenOrderIdentities } from './screenOrderIdentityModel.js';
import { ScreenOrderRowActions } from './ScreenOrderRowActions.jsx';
import { META } from '../../config/blockMeta.jsx';

export function ScreenOrderList(props) {
  if (props.listOnly) return (
    <section className="screen-order-v2-card screen-order-v2-list-view">
      <ScreenOrderListItems {...props} />
    </section>
  );
  const selectedIndex = props.normalBlocks.findIndex((block) => block.id === props.selectedId);
  const selectedBlock = props.normalBlocks[selectedIndex];
  const selectedIdentity = selectedBlock ? createScreenOrderIdentities(props.normalBlocks)[selectedIndex] : null;

  return (
    <section className="screen-order-v2-card">
      {selectedBlock && (
        <ScreenOrderSettings
          key={selectedBlock.id}
          block={selectedBlock}
          identity={selectedIdentity}
          renderBlockEditor={props.renderBlockEditor}
          actions={<ScreenOrderRowActions block={selectedBlock} meta={META[selectedBlock.type] || META.text} selected instance="inspector"
            canMoveUp={selectedIndex > 0} canMoveDown={selectedIndex < props.normalBlocks.length - 1}
            onMoveUp={() => props.reorderToIndex(selectedBlock.id, selectedIndex - 1)}
            onMoveDown={() => props.reorderToIndex(selectedBlock.id, selectedIndex + 1)}
            onDuplicate={() => props.duplicateBlock(selectedBlock.id)} onRemove={() => props.removeBlock(selectedBlock.id)} />}
        />
      )}
    </section>
  );
}
