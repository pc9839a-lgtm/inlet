import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Smartphone } from 'lucide-react';
import './WorkspacePreviewPane.css';
import PreviewRenderer from '../../preview/LandingRenderer.jsx';
import { PreviewSelectionToolbar } from './PreviewSelectionToolbar.jsx';
import { notify } from '../../lib/uiFeedback.js';

const PREVIEW_CONTENT_WIDTH = 390;

export function WorkspacePreviewPane({
  previewPage,
  leads,
  selectedBlockId,
  onSelectPreviewBlock,
  blockActions,
}) {
  const previewRef = useRef(null);
  const frameRef = useRef(null);
  const [zoom, setZoom] = useState(100);
  const fullscreen = async () => {
    try { await frameRef.current?.requestFullscreen(); }
    catch { notify('전체 화면을 열지 못했습니다.', 'error'); }
  };

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
        <div className="preview-stage-toolbar">
          <div className="preview-width-toolbar" aria-label="미리보기 화면 폭" data-preview-width={PREVIEW_CONTENT_WIDTH}>
            <Smartphone size={16} aria-hidden="true" />
            <span>모바일 <span className="preview-width-value">{PREVIEW_CONTENT_WIDTH}px</span></span>
          </div>
          <div className="preview-view-tools">
            <select aria-label="미리보기 배율" title="보기 배율" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
              {[75, 100, 125].map(value => <option key={value} value={value}>{value}%</option>)}
            </select>
            <button type="button" aria-label="미리보기 전체 화면" title="전체 화면" onClick={fullscreen}>
              <Maximize2 size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <PreviewSelectionToolbar page={previewPage} selectedBlockId={selectedBlockId} actions={blockActions} />
        <div className="phone-frame" ref={frameRef} style={{ zoom: zoom / 100 }}>
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
