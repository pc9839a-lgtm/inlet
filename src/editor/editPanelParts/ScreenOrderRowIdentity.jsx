import React from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';
import { T } from './editorLabels.js';
import { stop } from './editorEvents.js';

export function ScreenOrderRowIdentity({ block, identity, meta, open, onDragStart, onDragEnd, onSelectRow, onSelectRowByKey }) {
  const Icon = meta.icon;
  const ordinal = identity?.repeated ? ` ${identity.occurrence}` : '';
  const customLabel = identity?.customLabel ? ` · ${identity.customLabel}` : '';
  const displayLabel = `${meta.label}${ordinal}${customLabel}`;
  const detail = identity?.detail || '';
  const thumbnail = identity?.thumbnail || '';
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
        title={T.dragToReorder}
        aria-hidden="true"
      >
        <GripVertical size={16} />
      </div>

      <div
        className="screen-order-v2-title-wrap"
        role="button"
        tabIndex={0}
        aria-pressed={open}
        aria-label={`${displayLabel}${detail ? ` · ${detail}` : ''} 설정 선택`}
        onClick={selectTitle}
        onKeyDown={onSelectRowByKey}
      >
        <span className="screen-order-v2-type-icon" aria-hidden="true">
          <Icon size={16} />
          {thumbnail && (
            <img
              className="screen-order-v2-thumbnail"
              src={thumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(event) => { event.currentTarget.hidden = true; }}
            />
          )}
        </span>
        <span className="screen-order-v2-identity-copy">
          <strong title={displayLabel}>{displayLabel}</strong>
          {detail && <small className="screen-order-v2-identity-detail" title={detail}>{detail}</small>}
        </span>
        <span className="screen-order-v2-chevron" aria-hidden="true">
          <ChevronRight size={15} />
        </span>
      </div>
    </>
  );
}
