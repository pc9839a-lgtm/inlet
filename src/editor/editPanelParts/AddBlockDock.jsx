import React, { useEffect, useRef } from 'react';
import { AddBlockDockToggle } from './AddBlockDockToggle.jsx';
import { AddBlockPanel } from './AddBlockPanel.jsx';

export function AddBlockDock({ addOpen, setAddOpen, addBlock, addSectionPattern, afterSelected = false, embedded = false, compact = false }) {
  const panelOpen = embedded || addOpen;
  const ref = useRef(null);
  useEffect(() => {
    if (!compact || !addOpen) return undefined;
    const outside = (event) => { if (!ref.current?.contains(event.target)) setAddOpen(false); };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setAddOpen(false);
      ref.current?.querySelector('.add-toggle')?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [compact, addOpen, setAddOpen]);

  return (
    <section ref={ref} className={`add-dock fixed-add-dock ${panelOpen ? 'open' : ''}${compact ? ' add-dock-compact' : ''}`}>
      {!embedded && <AddBlockDockToggle open={addOpen} compact={compact} onToggle={() => setAddOpen(!addOpen)} />}
      {panelOpen && <div className="editor-add-block-panel">
        <p className="editor-add-block-location">{afterSelected ? '선택한 블록 아래에 추가' : '마지막 콘텐츠 뒤에 추가'}</p>
        <AddBlockPanel onAdd={addBlock} onAddPattern={addSectionPattern} />
      </div>}
    </section>
  );
}
