import React from 'react';
import { AddBlockGroupGrid } from './AddBlockGroupGrid.jsx';

export function AddBlockPanel({ onAdd }) {
  return (
    <div className="add-panel">
      <AddBlockGroupGrid onAdd={onAdd} />
    </div>
  );
}
