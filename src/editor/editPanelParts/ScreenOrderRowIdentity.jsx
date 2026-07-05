import React from 'react';
import { GripVertical } from 'lucide-react';
import { T } from './editorLabels.js';
import { stop } from './editorEvents.js';

export function ScreenOrderRowIdentity({ block, index, meta, onDragStart, onDragEnd }) {
  const Icon = meta.icon;

  return (
    <>
      <div
        className="drag screen-drag-handle"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={stop}
        role="button"
        tabIndex={0}
        title={T.dragToReorder}
      >
        <GripVertical size={18} />
      </div>

      <div className="screen-title-wrap">
        <span className="screen-order-number">{index + 1}</span>
        <Icon size={17} />
        <strong>{meta.label}</strong>
      </div>
    </>
  );
}
