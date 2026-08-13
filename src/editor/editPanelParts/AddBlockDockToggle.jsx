import React from 'react';
import { Plus } from 'lucide-react';
import { T } from './editorLabels.js';

export function AddBlockDockToggle({ open, onToggle }) {
  return (
    <button className="add-toggle" type="button" onClick={onToggle}>
      <Plus size={18} />
      <strong>{T.add}</strong>
      <span>{open ? T.close : T.open}</span>
    </button>
  );
}