import React from 'react';
import { ANIMATION_OPTIONS } from './editorLabels.js';

export function AnimationTypeOptions({ value = 'fade', onSelect }) {
  return (
    <div className="edit-animation-options">
      {ANIMATION_OPTIONS.map(([key, label]) => (
        <button key={key} type="button" className={value === key ? 'active' : ''} onClick={() => onSelect(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}
