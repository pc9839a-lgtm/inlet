import React from 'react';
import { META } from '../../config/blockMeta.jsx';
import './ScreenOrder.css';
import { ScreenOrderListHeader } from './ScreenOrderListHeader.jsx';
import { ScreenOrderListItems } from './ScreenOrderListItems.jsx';
import { SelectedBlockSettings } from './SelectedBlockSettings.jsx';

export function ScreenOrderList(props) {
  const selectedBlock = props.normalBlocks.find((block) => block.id === props.selectedId) || null;
  const selectedMetaType = selectedBlock?.s?.widgetMode === 'youtube' ? 'youtube' : selectedBlock?.type;
  const selectedMeta = selectedBlock ? (META[selectedMetaType] || META.text) : null;

  return (
    <section className="screen-order-v2-card">
      <ScreenOrderListHeader />
      <ScreenOrderListItems {...props} />

      {selectedBlock && (
        <div className="screen-order-v2-settings-panel">
          <SelectedBlockSettings
            block={selectedBlock}
            meta={selectedMeta}
            renderBlockEditor={props.renderBlockEditor}
          />
        </div>
      )}
    </section>
  );
}
