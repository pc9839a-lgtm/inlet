import React from 'react';
import { Share2 } from 'lucide-react';
import { Switch } from './editorControls.jsx';

export function ShareOptionsCard({ page, updatePage }) {
  const enabled = page.share?.enabled !== false;

  return (
    <section className="edit-animation-card share-options-card">
      <div className="block-head fixed-block-head edit-animation-head share-options-head">
        <div className="fixed-block-copy">
          <Share2 size={17} aria-hidden="true" />
          <strong>{'\uACF5\uC720'}</strong>
          <em>{'\uD398\uC774\uC9C0 \uC6B0\uCE21 \uC0C1\uB2E8 \uD45C\uC2DC'}</em>
        </div>
        <Switch
          checked={enabled}
          onChange={(event) => updatePage({
            share: {
              ...(page.share || {}),
              enabled: event.target.checked,
              position: 'top-right',
              display: 'icon',
            },
          })}
          label={'\uACF5\uC720 \uBC84\uD2BC \uD45C\uC2DC'}
        />
      </div>
    </section>
  );
}
