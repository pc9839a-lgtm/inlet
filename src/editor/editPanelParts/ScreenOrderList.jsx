import React from 'react';
import './ScreenOrder.css';
import { ScreenOrderListHeader } from './ScreenOrderListHeader.jsx';
import { ScreenOrderListItems } from './ScreenOrderListItems.jsx';
import { ScreenOrderSettings } from './ScreenOrderSettings.jsx';
import { createScreenOrderIdentities } from './screenOrderIdentityModel.js';

export function ScreenOrderList(props) {
  if (props.listOnly) return (
    <section className="screen-order-v2-card screen-order-v2-list-view">
      <ScreenOrderListHeader />
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
        />
      )}
    </section>
  );
}
