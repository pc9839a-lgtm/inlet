import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AddBlockDockToggle } from './AddBlockDockToggle.jsx';
import { AddBlockPanel } from './AddBlockPanel.jsx';

export function AddBlockDock({ addOpen, setAddOpen, addBlock, addSectionPattern, afterSelected = false, embedded = false, compact = false }) {
  const panelOpen = embedded || addOpen;
  const ref = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!compact || !addOpen || typeof document === 'undefined') return undefined;
    previousFocusRef.current = document.activeElement;
    const focusFrame = requestAnimationFrame(() => dialogRef.current?.querySelector('input[type="search"]')?.focus());
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setAddOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])')]
        .filter((item) => item.getClientRects().length);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown, true);
      const previous = previousFocusRef.current;
      if (previous?.isConnected) requestAnimationFrame(() => previous.focus({ preventScroll: true }));
    };
  }, [compact, addOpen, setAddOpen]);

  const addFromGallery = (type) => {
    addBlock(type);
    setAddOpen(false);
  };

  const dialog = compact && addOpen && typeof document !== 'undefined'
    ? createPortal(
      <div className="editor-gallery-backdrop" onPointerDown={(event) => {
        if (event.currentTarget === event.target) setAddOpen(false);
      }}>
        <section ref={dialogRef} id="editor-block-gallery-dialog" className="editor-gallery-dialog"
          role="dialog" aria-modal="true" aria-labelledby="editor-block-gallery-title">
          <header className="editor-gallery-dialog-head">
            <div>
              <span className="editor-gallery-eyebrow">페이지 구성</span>
              <h2 id="editor-block-gallery-title">블록 추가</h2>
              <p>{afterSelected ? '선택한 블록 다음에 추가합니다.' : '페이지 콘텐츠 끝에 추가합니다.'}</p>
            </div>
            <button type="button" className="editor-gallery-close" onClick={() => setAddOpen(false)} aria-label="블록 추가 닫기"><X size={20} /></button>
          </header>
          <div className="editor-gallery-dialog-scroll">
            <AddBlockPanel onAdd={addFromGallery} />
          </div>
        </section>
      </div>, document.body
    ) : null;

  return (
    <section ref={ref} className={`add-dock fixed-add-dock ${panelOpen ? 'open' : ''}${compact ? ' add-dock-compact' : ''}`}>
      {!embedded && <AddBlockDockToggle open={addOpen} compact={compact} onToggle={() => setAddOpen(!addOpen)} />}
      {!compact && panelOpen && (
        <div className="editor-add-block-panel">
          <p className="editor-add-block-location">{afterSelected ? '선택한 블록 아래에 추가' : '마지막 콘텐츠 뒤에 추가'}</p>
          <AddBlockPanel onAdd={addBlock} onAddPattern={addSectionPattern} />
        </div>
      )}
      {dialog}
    </section>
  );
}
