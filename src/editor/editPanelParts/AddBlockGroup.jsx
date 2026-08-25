import React from 'react';
import { getAddableBlocksByCategory } from './addBlockCatalog.js';
import { AddBlockOption } from './AddBlockOption.jsx';

function normalizeSearch(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, '');
}

export function AddBlockGroup({ category, label, onAdd, query = '' }) {
  const normalizedQuery = normalizeSearch(query);
  const items = getAddableBlocksByCategory(category).filter(([type, meta]) => {
    if (!normalizedQuery) return true;
    const haystack = normalizeSearch([type, meta?.label, meta?.badge, label].filter(Boolean).join(' '));
    return haystack.includes(normalizedQuery);
  });
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
