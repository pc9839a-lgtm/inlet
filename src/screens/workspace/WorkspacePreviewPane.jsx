import React, { useEffect, useRef } from 'react';
import './WorkspacePreviewPane.css';
import PreviewRenderer from '../../preview/LandingRenderer.jsx';

export function WorkspacePreviewPane({
  previewPage,
  leads,
   selectedBlockId,
  onSelectPreviewBlock,
}) {
  const previewRef = useRef(null);

  useEffect(() => {
    if (!selectedBlockId || typeof window === 'undefined') return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = previewRef.current?.querySelector('[data-preview-selected="true"]')
        || previewRef.current?.querySelector(`#block-${selectedBlockId}`);
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedBlockId]);

  return (
    <main className="preview-workspace" ref={previewRef}>
      <div className="preview-sticky">
        <div className="phone-frame">
          <PreviewRenderer
            page={previewPage}
            editorPreview
            leads={leads}
            // Preview submissions are local UI demonstrations only.
            addLead={async (lead) => ({ ...lead, isTest: true })}
            track={() => {}}
            selectedBlockId={selectedBlockId}
            onSelectBlock={onSelectPreviewBlock}
          />
        </div>
      </div>
    </main>
  );
}
