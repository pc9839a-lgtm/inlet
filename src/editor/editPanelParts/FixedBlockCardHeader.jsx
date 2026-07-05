import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { T } from './editorLabels.js';
import { IconAction, Switch } from './editorControls.jsx';

export function FixedBlockCardHeader({ title, badge, visible, open, onToggleOpen, onToggleVisible }) {
  return (
    <div className="block-head fixed-block-head">
      <div className="fixed-block-copy">
        <strong>{title}</strong>
        <em>{badge}</em>
      </div>
      <Switch checked={visible} onChange={onToggleVisible} label={`${title} ${T.show}`} />
      <IconAction className="fixed-open-button" onClick={onToggleOpen} aria-label={`${title} ${open ? T.close : T.open}`}>
        {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </IconAction>
    </div>
  );
}