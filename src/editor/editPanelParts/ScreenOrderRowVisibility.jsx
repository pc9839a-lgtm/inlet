import React from 'react';
import { T } from './editorLabels.js';
import { stop } from './editorEvents.js';

export function ScreenOrderRowVisibility({ visible, onToggleVisible }) {
  const active = Boolean(visible);
  return (
    <div className="screen-row-visibility" onClick={stop}>
      <button
        type="button"
        className={`screen-order-visibility-toggle${active ? ' is-on' : ''}`}
        role="switch"
        aria-checked={active}
        aria-label={active ? T.show : T.hide}
        onClick={(event) => {
          stop(event);
          onToggleVisible?.({ target: { checked: !active } });
        }}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );
}
