import React from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';
import { T } from './editorLabels.js';
import { stop } from './editorEvents.js';

export function ScreenOrderRowIdentity({ block, meta, open, onDragStart, onDragEnd, onSelectRow, onSelectRowByKey }) {
  const Icon = meta.icon;
  const selectTitle = (event) => {
    stop(event);
    onSelectRow?.();
  };

  return (
    <>
      <div
        className="screen-order-v2-drag"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={stop}
        role="button"
        tabIndex={0}
        title={T.dragToReorder}
        aria-label={`${meta.label} 순서 이동`}
      >
        <GripVertical size={17} />
      </div>

      <div className="screen-order-v2-title-wrap" role="button" tabIndex={0} aria-expanded={open} onClick={selectTitle} onKeyDown={onSelectRowByKey}>
        <span className="screen-order-v2-type-icon" aria-hidden="true">
          <Icon size={17} />
        </span>
        <strong>{meta.label}</strong>
        <span className={`screen-order-v2-chevron${open ? ' is-open' : ''}`} aria-hidden="true">
          <ChevronRight size={16} />
        </span>
      </div>
    </>
  );
}
