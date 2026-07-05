import React from 'react';
import { AddBlockDock } from './editPanelParts/AddBlockDock.jsx';
import { PageGlobalOptions } from './editPanelParts/PageGlobalOptions.jsx';
import { ScreenOrderList } from './editPanelParts/ScreenOrderList.jsx';
import { SelectedBlockSettings } from './editPanelParts/SelectedBlockSettings.jsx';

export function EditPanelLayout({
  pageGlobalOptionsProps,
  screenOrderListProps,
  selectedBlockSettingsProps,
  addBlockDockProps,
  selectedSettingsRef,
}) {
  return (
    <div className="edit-layout">
      <PageGlobalOptions {...pageGlobalOptionsProps} />
      <ScreenOrderList {...screenOrderListProps} />

      <SelectedBlockSettings
        {...selectedBlockSettingsProps}
        ref={selectedSettingsRef}
      />

      <AddBlockDock {...addBlockDockProps} />
    </div>
  );
}