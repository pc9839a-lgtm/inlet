import React from 'react';
import { ScreenDropZone } from './ScreenDropZone.jsx';

export function ScreenOrderItemDropTargets({ controls, isLast, children }) {
  return (
    <>
      <ScreenDropZone
        onDragOver={controls.activateDrop}
        onDragEnter={controls.activateDrop}
        onDragLeave={controls.clearDrop}
        onDrop={controls.dropBefore}
      />

      {children}

      {isLast && (
        <ScreenDropZone
          last
          onDragOver={controls.activateDrop}
          onDragEnter={controls.activateDrop}
          onDragLeave={controls.clearDrop}
          onDrop={controls.dropAfter}
        />
      )}
    </>
  );
}
