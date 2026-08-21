import React from 'react';

export function AddBlockOption({ type, meta, onAdd }) {
  const Icon = meta.icon;

  return (
    <button type="button" onClick={() => onAdd(meta.addType || type, meta.preset || '')}>
      <Icon size={16} />
      <strong>{meta.label}</strong>
    </button>
  );
}