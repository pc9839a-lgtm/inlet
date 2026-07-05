import React from 'react';
import { T } from './editorLabels.js';

export function SelectedBlockSettingsHeader({ meta }) {
  return (
    <div className="section-title selected-block-settings-title">
      <h2>{T.selectedBlockSettings}</h2>
      <p>{meta?.label}</p>
    </div>
  );
}