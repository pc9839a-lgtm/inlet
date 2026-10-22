import React from 'react';
import { T } from './editorLabels.js';
import { Switch } from './editorControls.jsx';
import { ChevronDown } from 'lucide-react';

export function AnimationOptionsHeader({ enabled, onToggle, expanded, onToggleExpanded, panelId }) {
  return (
    <div className="block-head fixed-block-head edit-animation-head page-option-head">
      <div>
        <b>{T.animation}</b>
      </div>
      <Switch checked={enabled} onChange={onToggle} label={T.animationUse} />
      <button type="button" className="page-option-expand" disabled={!enabled} aria-expanded={!!enabled && expanded} aria-controls={panelId} aria-label={`애니메이션 ${expanded ? '접기' : '설정 보기'}`} onClick={onToggleExpanded}>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
