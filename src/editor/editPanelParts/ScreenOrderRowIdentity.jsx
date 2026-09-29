import React from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';
import { T } from './editorLabels.js';
import { stop } from './editorEvents.js';

export function ScreenOrderRowIdentity({ block, meta, open, onDragStart, onDragEnd, onSelectRow, onSelectRowByKey }) {
  const Icon = meta.icon;
  const customLabel = block.type === 'code' ? String(block.s?.editorLabel || '').trim() : '';
  const displayLabel = customLabel ? `${meta.label} · ${customLabel}` : meta.label;
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
        aria-label={`${displayLabel} 순서 이동`}
      >
        <GripVertical size={16} />
      </div>

      <div
        className="screen-order-v2-title-wrap"
        role="button"
        tabIndex={0}
        aria-pressed={open}
        aria-label={`${displayLabel} 설정 선택`}
        onClick={selectTitle}
        onKeyDown={onSelectRowByKey}
      >
        <span className="screen-order-v2-type-icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        <strong title={displayLabel}>{displayLabel}</strong>
        <span className="screen-order-v2-chevron" aria-hidden="true">
          <ChevronRight size={15} />
        </span>
      </div>
    </>
  );
}
