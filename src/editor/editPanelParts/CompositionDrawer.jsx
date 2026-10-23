import React from 'react';
import { X } from 'lucide-react';

export function CompositionDrawer({ open, onClose, children, dialogRef }) {
  const ref = dialogRef;
  React.useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) {
      dialog.showModal();
      queueMicrotask(() => dialog.querySelector('.screen-order-v2-item[data-selected="true"] .screen-order-v2-title-wrap')?.focus());
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="editor-composition-dialog" aria-labelledby="editor-composition-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="editor-composition-surface">
        <header className="editor-composition-heading">
          <h2 id="editor-composition-title">구성</h2>
          <button type="button" aria-label="구성 닫기" onClick={onClose}><X size={18} /></button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
