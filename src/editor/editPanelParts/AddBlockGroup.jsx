import React from 'react';
import { getAddableBlocksByCategory } from './addBlockCatalog.js';
import { AddBlockOption } from './AddBlockOption.jsx';

export function AddBlockGroup({ category, label, onAdd }) {
  const items = getAddableBlocksByCategory(category);
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
