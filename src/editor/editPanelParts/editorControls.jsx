import React from 'react';
import { stop } from './editorEvents.js';

export function Switch({ checked, onChange, label }) {
  const active = !!checked;

  return (
    <button
      type="button"
      className={`switch-clean${active ? ' active' : ''}`}
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={(event) => {
        stop(event);
        onChange?.({ target: { checked: !active } });
      }}
    >
      <i />
    </button>
  );
}

export function IconAction({ children, className = '', ...props }) {
  return (
    <button type="button" className={`screen-icon-action ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}