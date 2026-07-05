import React, { Suspense } from 'react';
import { LazyChunkBoundary } from '../../runtime/LazyRuntimeBoundary.jsx';
import { PreviewRenderer } from './workspaceLazySurfaces.jsx';

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
  return (
    <main className="preview-workspace">
      <div className="preview-sticky">
        <div className="preview-top">
          <div className="preview-title">
            <span>모바일 미리보기</span>
            <strong>/{page.slug}</strong>
          </div>
          <a className="preview-link" href={previewUrl} target="_blank" rel="noreferrer">{previewUrl}</a>
        </div>
        <div className="phone-frame">
          <LazyChunkBoundary resetKey="preview" variant="preview">
            <Suspense fallback={<div className="muted small">미리보기를 불러오는 중입니다.</div>}>
              <PreviewRenderer
                page={previewPage}
                leads={leads}
                addLead={addLead}
                track={track}
                selectedBlockId={selectedBlockId}
                onSelectBlock={onSelectPreviewBlock}
              />
            </Suspense>
          </LazyChunkBoundary>
        </div>
      </div>
    </main>
  );
}