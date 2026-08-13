import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { T } from './editorLabels.js';
import { stop } from './editorEvents.js';

export function ScreenOrderRowVisibility({ visible, onToggleVisible }) {
  const active = Boolean(visible);
  return (
    <div className="screen-order-v2-visibility" onClick={stop}>
      <button
        type="button"
        className={`screen-order-v2-visibility-button${active ? '' : ' is-hidden'}`}
        role="switch"
        aria-checked={active}
        aria-label={active ? T.hide : T.show}
        title={active ? '숨기기' : '표시하기'}
        onClick={(event) => {
          stop(event);
          onToggleVisible?.({ target: { checked: !active } });
        }}
      >
        {active ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
    </div>
  );
}
