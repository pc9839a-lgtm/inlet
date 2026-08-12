import React from 'react';

export function ScreenDropZone({ last = false, onDragOver, onDragEnter, onDragLeave, onDrop }) {
  return (
    <div
      className={`screen-order-v2-drop-zone${last ? ' last' : ''}`}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-hidden="true"
    >
      <span />
    </div>
  );
}
