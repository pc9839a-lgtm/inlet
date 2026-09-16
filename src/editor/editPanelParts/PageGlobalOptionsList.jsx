import React from 'react';
import { AnimationOptionsCard } from './AnimationOptionsCard.jsx';
import { ShareOptionsCard } from './ShareOptionsCard.jsx';

export function PageGlobalOptionsList({ page, updateTheme, updatePage }) {
  return (
    <div className="page-global-options-list page-global-grid">
      <AnimationOptionsCard page={page} updateTheme={updateTheme} />
      <ShareOptionsCard page={page} updatePage={updatePage} />
    </div>
  );
}
