import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { T } from './editorLabels.js';
import { stop } from './editorEvents.js';

export function ScreenOrderRowVisibility({ visible, onToggleVisible }) {
  const active = Boolean(visible);
  const Icon = active ? Eye : EyeOff;

  return (
    <div className="screen-order-v2-visibility" onClick={stop}>
      <button
        type="button"
        className={`screen-order-v2-visibility-button${active ? '' : ' is-hidden'}`}
        role="switch"
        aria-checked={active}
        aria-label={active ? T.hide : T.show}
        title={active ? T.hide : T.show}
        onClick={(event) => {
          stop(event);
          onToggleVisible?.({ target: { checked: !active } });
        }}
      >
        <Icon size={17} />
      </button>
    </div>
  );
}
