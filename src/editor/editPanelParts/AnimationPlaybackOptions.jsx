import React from 'react';
import { ANIMATION_PLAYBACK_OPTIONS } from './editorLabels.js';

export function AnimationPlaybackOptions({ value = 'once', onSelect }) {
  return (
    <div className="edit-animation-options edit-animation-playback-options">
      {ANIMATION_PLAYBACK_OPTIONS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={value === key ? 'active' : ''}
          aria-pressed={value === key}
          onClick={() => onSelect(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}