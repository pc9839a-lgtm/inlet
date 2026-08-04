import React from 'react';
import { AddBlockDockToggle } from './AddBlockDockToggle.jsx';
import { AddBlockPanel } from './AddBlockPanel.jsx';

export function AddBlockDock({ addOpen, setAddOpen, openId, addBlock }) {
  return (
    <section className={`add-dock fixed-add-dock ${addOpen ? 'open' : ''} ${openId ? 'editing' : ''}`}>
      <AddBlockDockToggle open={addOpen} onToggle={() => setAddOpen(!addOpen)} />
      {addOpen && <AddBlockPanel onAdd={addBlock} />}
    </section>
  );
}
