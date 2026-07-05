import React from 'react';
import { ADD_GROUPS } from './editorLabels.js';
import { AddBlockGroup } from './AddBlockGroup.jsx';

export function AddBlockGroupGrid({ onAdd }) {
  return (
    <div className="widget-group-grid">
      {ADD_GROUPS.map(([category, label]) => (
        <AddBlockGroup key={category} category={category} label={label} onAdd={onAdd} />
      ))}
    </div>
  );
}
