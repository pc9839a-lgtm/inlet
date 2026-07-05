import React from 'react';
import { AnimationOptionsHeader } from './AnimationOptionsHeader.jsx';
import { AnimationTypeOptions } from './AnimationTypeOptions.jsx';

export function AnimationOptionsCard({ page, updateTheme }) {
  return (
    <section className="edit-animation-card">
      <AnimationOptionsHeader enabled={page.theme.animOn} onToggle={(event) => updateTheme({ animOn: event.target.checked })} />
      {page.theme.animOn && (
        <AnimationTypeOptions value={page.theme.animType || 'fade'} onSelect={(animType) => updateTheme({ animType })} />
      )}
    </section>
  );
}
