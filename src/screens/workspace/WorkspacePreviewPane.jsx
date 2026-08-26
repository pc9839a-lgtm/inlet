import React, { useEffect, useRef } from 'react';
import PreviewRenderer from '../../preview/LandingRenderer.jsx';

export function WorkspacePreviewPane({
  page,
  previewUrl,
  previewPage,
  leads,
  addLead,
  track,
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
        <div className="preview-top">
          <div className="preview-title">
            <span>모바일 미리보기</span>
            <strong>/{page.slug}</strong>
          </div>
          <a className="preview-link" href={previewUrl} target="_blank" rel="noreferrer">{previewUrl}</a>
        </div>
        <div className="phone-frame">
          <PreviewRenderer
            page={previewPage}
            leads={leads}
            addLead={addLead}
            track={track}
            selectedBlockId={selectedBlockId}
            onSelectBlock={onSelectPreviewBlock}
          />
        </div>
      </div>
    </main>
  );
}
