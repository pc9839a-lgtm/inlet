import React from 'react';
import { AddBlockDock } from './editPanelParts/AddBlockDock.jsx';
import { PageGlobalOptions } from './editPanelParts/PageGlobalOptions.jsx';
import { ScreenOrderList } from './editPanelParts/ScreenOrderList.jsx';

export function EditPanelLayout({
  pageGlobalOptionsProps,
  screenOrderListProps,
  addBlockDockProps,
}) {
  return (
    <div className="edit-layout">
      <PageGlobalOptions {...pageGlobalOptionsProps} />
      <ScreenOrderList {...screenOrderListProps} />

      <AddBlockDock {...addBlockDockProps} />
    </div>
  );
}