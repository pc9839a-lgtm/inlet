import React, { useEffect, useRef, useState } from 'react';
import './WorkspacePreviewPane.css';
import PreviewRenderer from '../../preview/LandingRenderer.jsx';

const PREVIEW_CONTENT_WIDTHS = [360, 390, 430];

export function WorkspacePreviewPane({
  previewPage,
  leads,
  selectedBlockId,
  onSelectPreviewBlock,
}) {
  const previewRef = useRef(null);
  const frameRef = useRef(null);
  const [contentWidth, setContentWidth] = useState(390);
  const [measuredWidth, setMeasuredWidth] = useState(null);

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

  useEffect(() => {
    const content = frameRef.current?.querySelector('.landing-page');
    if (!content) return undefined;

    // Report the rendered landing width, not the outer frame including its border.
    const measure = () => setMeasuredWidth(Math.round(content.getBoundingClientRect().width));
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(content);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [contentWidth]);

  return (
    <main
      className="preview-workspace"
      ref={previewRef}
      style={{ '--editor-preview-content-width': `${contentWidth}px` }}
    >
      <div className="preview-sticky">
        <div className="preview-width-toolbar" aria-label="미리보기 화면 폭">
          <span className="preview-width-label">화면 폭</span>
          <div className="preview-width-options" role="group" aria-label="미리보기 콘텐츠 폭 선택">
            {PREVIEW_CONTENT_WIDTHS.map((width) => (
              <button
                key={width}
                type="button"
                className="preview-width-option"
                data-content-width={width}
                aria-label={`미리보기 콘텐츠 폭 ${width}px`}
                aria-pressed={contentWidth === width}
                onClick={() => setContentWidth(width)}
              >
                {width}
              </button>
            ))}
          </div>
          <output className="preview-width-measured" data-measured-width={measuredWidth ?? ''} aria-live="polite">
            실제 {measuredWidth === null ? '측정 중' : `${measuredWidth}px`}
          </output>
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
