import React from 'react';

export function AddBlockOption({ type, meta, onAdd }) {
  const Icon = meta.icon;

  return (
    <button type="button" onClick={() => onAdd(type)}>
      <Icon size={16} />
      <strong>{meta.label}</strong>
    </button>
  );
}