import React from 'react';
import { AnimationOptionsHeader } from './AnimationOptionsHeader.jsx';
import { AnimationTypeOptions } from './AnimationTypeOptions.jsx';
import { T } from './editorLabels.js';

export function AnimationOptionsCard({ page, updateTheme }) {
  return (
    <section className="edit-animation-card">
      <AnimationOptionsHeader enabled={page.theme.animOn} onToggle={(event) => updateTheme({ animOn: event.target.checked })} />
      {page.theme.animOn && (
        <div className="edit-animation-settings">
          <div className="edit-animation-setting-group">
            <strong>{T.animationEffect}</strong>
            <AnimationTypeOptions value={page.theme.animType || 'fade'} onSelect={(animType) => updateTheme({ animType })} />
          </div>

        </div>
      )}
    </section>
  );
}
