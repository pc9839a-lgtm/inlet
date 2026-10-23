import React, { useEffect, useRef } from 'react';
import './WorkspacePreviewPane.css';
import PreviewRenderer from '../../preview/LandingRenderer.jsx';

const PREVIEW_CONTENT_WIDTH = 390;

export function WorkspacePreviewPane({
  previewPage,
  leads,
  selectedBlockId,
  onSelectPreviewBlock,
}) {
  const previewRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!selectedBlockId || typeof window === 'undefined') return undefined;
    const frame = window.requestAnimationFrame(() => {
      const scroller = frameRef.current?.querySelector('.landing-page');
      const target = previewRef.current?.querySelector('[data-preview-selected="true"]')
        || previewRef.current?.querySelector(`#block-${selectedBlockId}`);
      if (!scroller || !target || !scroller.contains(target)) return;

      // D05: scroll only the phone's landing content. scrollIntoView() scrolls
      // the page itself when editor and preview stack on narrow desktop.
      const viewport = scroller.getBoundingClientRect();
      const block = target.getBoundingClientRect();
      const offset = (block.top + block.height / 2) - (viewport.top + viewport.height / 2);
      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const next = Math.max(0, Math.min(maxScroll, scroller.scrollTop + offset));
      if (Math.abs(scroller.scrollTop - next) > 1) scroller.scrollTop = next;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedBlockId]);

  return (
    <main
      className="preview-workspace"
      ref={previewRef}
      style={{ '--editor-preview-content-width': `${PREVIEW_CONTENT_WIDTH}px` }}
    >
      <div className="preview-sticky">
        <div className="preview-width-toolbar" aria-label="미리보기 화면 폭" data-preview-width={PREVIEW_CONTENT_WIDTH}>
          <span>모바일</span>
          <span className="preview-width-value">{PREVIEW_CONTENT_WIDTH}px</span>
        </div>
        <div className="phone-frame" ref={frameRef}>
          <PreviewRenderer
            page={previewPage}
            leads={leads}
            editorPreview
            selectedBlockId={selectedBlockId}
            onSelectBlock={onSelectPreviewBlock}
          />
        </div>
      </div>
    </main>
  );
}
