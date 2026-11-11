import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, MousePointer2, Pencil, Plus } from 'lucide-react';
import { META } from '../../config/blockMeta.jsx';
import { createScreenOrderIdentities } from '../../editor/editPanelParts/screenOrderIdentityModel.js';
import './WorkspacePreviewPane.css';
import PreviewRenderer from '../../preview/LandingRenderer.jsx';

const PREVIEW_CONTENT_WIDTH = 390;

// An editor-only workbench surrounding the real 390px page. Actions are
// delegated to the existing guarded draft handlers, never a second page model.
export function WorkspacePreviewPane({
  previewPage,
  leads,
  selectedBlockId,
  onSelectPreviewBlock,
  onEditPreviewText,
  onReplacePreviewImage,
  onEditPreviewLinkItem,
  onEditPreviewBottomButton,
  selectedCanvasBlock,
  canvasActions,
}) {
  const previewRef = useRef(null);
  const frameRef = useRef(null);
  const [toolsTop, setToolsTop] = useState(76);

  useEffect(() => {
    if (!selectedBlockId || typeof window === 'undefined') return undefined;
    const frame = window.requestAnimationFrame(() => {
      const scroller = frameRef.current?.querySelector('.landing-page');
      const target = previewRef.current?.querySelector('[data-preview-selected="true"]')
        || previewRef.current?.querySelector(`#block-${selectedBlockId}`);
      if (!scroller || !target || !scroller.contains(target)) return;

      // Scroll only the 390px phone, never the outer editor or block list.
      const viewport = scroller.getBoundingClientRect();
      const block = target.getBoundingClientRect();
      const offset = (block.top + block.height / 2) - (viewport.top + viewport.height / 2);
      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const next = Math.max(0, Math.min(maxScroll, scroller.scrollTop + offset));
      if (Math.abs(scroller.scrollTop - next) > 1) scroller.scrollTop = next;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedBlockId]);

  // Keep the workbench tools alongside the selected page region as the user
  // scrolls. Do not insert tool nodes into the published landing DOM.
  useEffect(() => {
    if (!selectedCanvasBlock || !canvasActions || typeof window === 'undefined') return undefined;
    const frame = frameRef.current;
    const scroller = frame?.querySelector('.landing-page');
    if (!frame || !scroller) return undefined;
    const findTarget = () => [...frame.querySelectorAll('[id^="block-"]')]
      .find((item) => item.id === `block-${selectedCanvasBlock.id}`);
    const update = () => {
      const target = findTarget();
      if (!target) return;
      const relativeTop = target.getBoundingClientRect().top - frame.getBoundingClientRect().top;
      const top = Math.max(12, Math.min(frame.clientHeight - 250, relativeTop));
      const clamped = Math.round(Math.max(12, top));
      setToolsTop((previous) => Math.abs(previous - clamped) < 2 ? previous : clamped);
    };
    const raf = window.requestAnimationFrame(update);
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (observer) {
      observer.observe(frame);
      const target = findTarget();
      if (target) observer.observe(target);
    }
    return () => {
      window.cancelAnimationFrame(raf);
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [selectedCanvasBlock?.id, canvasActions, previewPage?.blocks]);

  const identity = selectedCanvasBlock ? createScreenOrderIdentities([selectedCanvasBlock])[0] : null;
  const selectedType = selectedCanvasBlock
    ? META[selectedCanvasBlock.s?.widgetMode === 'youtube' ? 'youtube' : selectedCanvasBlock.type]?.label || '블록'
    : '';
  const selectedTitle = identity?.customLabel || identity?.contentTitle || selectedType;
  const showCanvasTools = Boolean(selectedCanvasBlock && canvasActions);

  return (
    <main
      className="preview-workspace"
      ref={previewRef}
      style={{ '--editor-preview-content-width': `${PREVIEW_CONTENT_WIDTH}px` }}
    >
      <div className="preview-sticky">
        <div className="preview-stage-heading">
          <div className="preview-stage-label">
            <span className="preview-stage-signal" aria-hidden="true" />
            <strong>페이지 화면</strong>
          </div>
          <span className="preview-stage-width">모바일 · 390px</span>
        </div>
        <p className="editor-canvas-hint"><MousePointer2 size={15} aria-hidden="true" />화면에서 원하는 블록을 선택하세요</p>
        <div className="editor-preview-frame-wrap">
          <div className="phone-frame" ref={frameRef}>
            <PreviewRenderer
              page={previewPage}
              leads={leads}
              editorPreview
              selectedBlockId={selectedBlockId}
              onSelectBlock={onSelectPreviewBlock}
              onEditPreviewText={onEditPreviewText}
              onReplacePreviewImage={onReplacePreviewImage}
              onEditPreviewLinkItem={onEditPreviewLinkItem}
              onEditPreviewBottomButton={onEditPreviewBottomButton}
            />
          </div>
          {showCanvasTools && (
            <aside className="editor-canvas-tools" role="toolbar" aria-label="선택한 블록 빠른 작업"
              data-canvas-block-id={selectedCanvasBlock.id} style={{ '--canvas-tools-top': `${toolsTop}px` }}>
              <div className="editor-canvas-tools-heading">
                <span>선택한 블록</span>
                <strong title={selectedTitle}>{selectedTitle}</strong>
                <small>{selectedType}</small>
              </div>
              <div className="editor-canvas-tools-primary">
                <button type="button" onClick={canvasActions.onEdit} aria-label="선택한 블록 내용 편집">
                  <Pencil size={16} aria-hidden="true" />내용 편집
                </button>
                <button type="button" className="editor-canvas-add-after" onClick={canvasActions.onAdd}
                  aria-label="선택한 블록 아래에 추가">
                  <Plus size={16} aria-hidden="true" />아래에 추가
                </button>
              </div>
              <div className="editor-canvas-tools-secondary">
                <button type="button" disabled={!canvasActions.canMoveUp} title="블록 위로 이동"
                  aria-label="선택한 블록 위로 이동" onClick={canvasActions.onMoveUp}><ArrowUp size={16} aria-hidden="true" /></button>
                <button type="button" disabled={!canvasActions.canMoveDown} title="블록 아래로 이동"
                  aria-label="선택한 블록 아래로 이동" onClick={canvasActions.onMoveDown}><ArrowDown size={16} aria-hidden="true" /></button>
                <button type="button" disabled={!canvasActions.canDuplicate} title="블록 복제"
                  aria-label="선택한 블록 복제" onClick={canvasActions.onDuplicate}><Copy size={16} aria-hidden="true" /></button>
              </div>
            </aside>
          )}
        </div>
        {canvasActions && (
          <button className="editor-canvas-bottom-add" type="button" onClick={canvasActions.onAdd}>
            <Plus size={17} aria-hidden="true" />
            {showCanvasTools ? '선택한 블록 아래에 추가' : '새 블록 추가'}
          </button>
        )}
        <span className="editor-canvas-caption">실제 모바일 화면 · 변경사항은 발행 전까지 공개되지 않습니다</span>
      </div>
    </main>
  );
}
