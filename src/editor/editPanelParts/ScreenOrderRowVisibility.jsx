import React from 'react';
import { T } from './editorLabels.js';
import { Switch } from './editorControls.jsx';
import { stop } from './editorEvents.js';

export function ScreenOrderRowVisibility({ visible, onToggleVisible }) {
  return (
    <div className="screen-row-visibility" onClick={stop}>
      <Switch checked={visible} onChange={onToggleVisible} label={visible ? T.show : T.hide} />
    </div>
  );
}
