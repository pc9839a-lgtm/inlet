import React from 'react';
import { AddBlockDockToggle } from './AddBlockDockToggle.jsx';
import { AddBlockPanel } from './AddBlockPanel.jsx';

export function AddBlockDock({ addOpen, setAddOpen, openId, addBlock, alwaysOpen = false }) {
  const open = alwaysOpen || addOpen;

  return (
    <section className={`add-dock fixed-add-dock ${open ? 'open' : ''} ${openId ? 'editing' : ''} ${alwaysOpen ? 'always-open' : ''}`}>
      {!alwaysOpen && <AddBlockDockToggle open={open} onToggle={() => setAddOpen(!open)} />}
      {open && <AddBlockPanel onAdd={addBlock} />}
    </section>
  );
}
