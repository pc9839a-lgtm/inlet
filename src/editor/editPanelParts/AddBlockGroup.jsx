import React from 'react';
import { AddBlockOption } from './AddBlockOption.jsx';

export function AddBlockGroup({ label, items = [], onAdd }) {
  if (!items.length) return null;

  return (
    <div className="widget-group">
      <b>{label}</b>
      <div>
        {items.map(([type, meta]) => (
          <AddBlockOption key={type} type={type} meta={meta} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
}
