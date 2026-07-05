import React from 'react';
import { SelectedBlockSettingsBody } from './SelectedBlockSettingsBody.jsx';
import { SelectedBlockSettingsHeader } from './SelectedBlockSettingsHeader.jsx';

export const SelectedBlockSettings = React.forwardRef(function SelectedBlockSettings({ block, meta, renderBlockEditor }, ref) {
  if (!block) return null;

  return (
    <section className="card selected-block-settings-card" data-block-type={block.type} ref={ref}>
      <SelectedBlockSettingsHeader meta={meta} />
      <SelectedBlockSettingsBody block={block} renderBlockEditor={renderBlockEditor} />
    </section>
  );
});