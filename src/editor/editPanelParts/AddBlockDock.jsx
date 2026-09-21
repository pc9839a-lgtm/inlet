import React from 'react';
import { AddBlockDockToggle } from './AddBlockDockToggle.jsx';
import { AddBlockPanel } from './AddBlockPanel.jsx';

export function AddBlockDock({ addOpen, setAddOpen, addBlock, addSectionPattern, embedded = false }) {
  const panelOpen = embedded || addOpen;

  return (
    <section className={`add-dock fixed-add-dock ${panelOpen ? 'open' : ''}`}>
      {panelOpen && <AddBlockPanel onAdd={addBlock} onAddPattern={addSectionPattern} />}
      {!embedded && <AddBlockDockToggle open={addOpen} onToggle={() => setAddOpen(!addOpen)} />}
    </section>
  );
}
