import React from 'react';
import { T } from './editorLabels.js';
import { Switch } from './editorControls.jsx';

export function AnimationOptionsHeader({ enabled, onToggle }) {
  return (
    <div className="block-head fixed-block-head edit-animation-head">
      <div>
        <b>{T.animation}</b>
      </div>
      <Switch checked={enabled} onChange={onToggle} label={T.animationUse} />
    </div>
  );
}
