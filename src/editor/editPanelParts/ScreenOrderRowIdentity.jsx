import React from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { T } from './editorLabels.js';
import { stop } from './editorEvents.js';

export function ScreenOrderRowIdentity({ block, index, meta, open, onDragStart, onDragEnd, onSelectRow, onSelectRowByKey }) {
  const Icon = meta.icon;
  const selectTitle = (event) => {
    stop(event);
    onSelectRow?.();
  };

  return (
    <>
      <div
        className="screen-drag-handle"
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

      <div className="screen-title-wrap" role="button" tabIndex={0} aria-expanded={open} onClick={selectTitle} onKeyDown={onSelectRowByKey}>
        <span className="screen-order-number">{index + 1}</span>
        <Icon size={17} />
        <strong>{meta.label}</strong>
        <span className="screen-row-chevron" aria-hidden="true">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>
    </>
  );
}
