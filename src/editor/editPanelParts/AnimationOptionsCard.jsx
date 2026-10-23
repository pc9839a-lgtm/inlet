import React from 'react';
import './AnimationOptionsCard.css';
import { AnimationOptionsHeader } from './AnimationOptionsHeader.jsx';
import { AnimationPlaybackOptions } from './AnimationPlaybackOptions.jsx';
import { AnimationTypeOptions } from './AnimationTypeOptions.jsx';
import { T } from './editorLabels.js';

export function AnimationOptionsCard({ page, updateTheme }) {
  const [expanded, setExpanded] = React.useState(false);
  const panelId = React.useId();
  return (
    <section className="edit-animation-card">
      <AnimationOptionsHeader
        enabled={page.theme.animOn}
        expanded={expanded}
        panelId={panelId}
        onToggleExpanded={() => setExpanded((value) => !value)}
        onToggle={(event) => {
          updateTheme({ animOn: event.target.checked });
          setExpanded(event.target.checked);
        }}
      />
      {page.theme.animOn && (
        <div id={panelId} className="edit-animation-settings" hidden={!expanded}>
          <div className="edit-animation-setting-group">
            <strong>{T.animationEffect}</strong>
            <AnimationTypeOptions value={page.theme.animType || 'fade'} onSelect={(animType) => updateTheme({ animType })} />
          </div>
          <div className="edit-animation-setting-group">
            <strong>{T.animationPlayback}</strong>
            <AnimationPlaybackOptions value={page.theme.animPlayback || 'once'} onSelect={(animPlayback) => updateTheme({ animPlayback })} />
          </div>
        </div>
      )}
    </section>
  );
}
