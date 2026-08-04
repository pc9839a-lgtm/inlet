import React from 'react';
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
  variant = 'phone',
}) {
  const canvasMode = variant === 'canvas';

  return (
    <main className={`preview-workspace${canvasMode ? ' preview-workspace-canvas' : ''}`}>
      <div className="preview-sticky">
        <div className="preview-top">
          <div className="preview-title">
            <span>{canvasMode ? '실시간 미리보기' : '모바일 미리보기'}</span>
            <strong>/{page.slug}</strong>
          </div>
          <a className="preview-link" href={previewUrl} target="_blank" rel="noreferrer">{previewUrl}</a>
        </div>
        <div className={canvasMode ? 'page-canvas-frame' : 'phone-frame'}>
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
