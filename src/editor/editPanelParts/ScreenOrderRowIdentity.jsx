import React from 'react';
import { GripVertical } from 'lucide-react';
import { T } from './editorLabels.js';
import { stop } from './editorEvents.js';

// Use a real, fixed thumbnail cell. A failed image falls back to the block
// type icon, and changing the image URL resets the loading/error state.
function BlockTypeThumbnail({ Icon, src }) {
  const [imageState, setImageState] = React.useState('loading');
  const ready = Boolean(src && imageState === 'ready');
  return (
    <span className={`screen-order-v2-type-icon${ready ? ' has-thumbnail' : ''}`} aria-hidden="true">
      <Icon size={16} />
      {src && imageState !== 'error' && (
        <img
          className="screen-order-v2-thumbnail"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setImageState('ready')}
          onError={() => setImageState('error')}
        />
      )}
    </span>
  );
}

export function ScreenOrderRowIdentity({ block, identity, meta, open, onDragStart, onDragEnd, onSelectRow, onSelectRowByKey }) {
  const Icon = meta.icon;
  const ordinal = identity?.repeated ? ` ${identity.occurrence}` : '';
  const customLabel = identity?.customLabel ? ` · ${identity.customLabel}` : '';
  const displayLabel = `${meta.label}${ordinal}${customLabel}`;
  const detail = identity?.detail || '';
  const typeLabel = `${meta.label}${ordinal}`;
  const primaryLabel = identity?.customLabel || typeLabel;
  const secondaryLabel = identity?.customLabel ? typeLabel : detail;
  const thumbnail = identity?.thumbnail || '';
  const summary = [displayLabel, detail, !block.visible ? '숨김' : ''].filter(Boolean).join(' · ');
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
        aria-label={`${summary} 설정 선택`}
        title={summary}
        onClick={selectTitle}
        onKeyDown={onSelectRowByKey}
      >
        <BlockTypeThumbnail key={thumbnail || 'block-type'} Icon={Icon} src={thumbnail} />
        <span className="screen-order-v2-identity-copy">
          <strong title={primaryLabel}>{primaryLabel}</strong>
          {(secondaryLabel || !block.visible) && (
            <span className="screen-order-v2-identity-subline">
              {secondaryLabel && (
                <small className="screen-order-v2-identity-detail" title={secondaryLabel}>{secondaryLabel}</small>
              )}
              {!block.visible && <span className="screen-order-v2-hidden-badge">숨김</span>}
            </span>
          )}
        </span>
      </div>
    </>
  );
}
