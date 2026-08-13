import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';

export function AddBlockDockToggle({ open, onToggle }) {
  return (
    <button className="add-toggle" type="button" onClick={onToggle} aria-expanded={open}>
      <Plus size={17} />
      <strong>블록 추가</strong>
      <span className={`add-toggle-chevron${open ? ' is-open' : ''}`} aria-hidden="true">
        <ChevronDown size={15} />
      </span>
    </button>
  );
}
