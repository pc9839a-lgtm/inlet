import React from 'react';
import { AddBlockDockToggle } from './AddBlockDockToggle.jsx';
import { AddBlockPanel } from './AddBlockPanel.jsx';

export function AddBlockDock({ addOpen, setAddOpen, openId, addBlock }) {
  if (openId) return null;

  return (
    <section className={`add-dock fixed-add-dock ${addOpen ? 'open' : ''}`}>
      {addOpen && <AddBlockPanel onAdd={addBlock} />}
      <AddBlockDockToggle open={addOpen} onToggle={() => setAddOpen(!addOpen)} />
    </section>
  );
}
