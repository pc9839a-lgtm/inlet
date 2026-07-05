import { createPortal } from 'react-dom';
import ImageCropActions from './ImageCropActions.jsx';
import ImageCropEmptyState from './ImageCropEmptyState.jsx';
import ImageCropHeader from './ImageCropHeader.jsx';
import ImageCropPreview from './ImageCropPreview.jsx';
import ImageCropSlider from './ImageCropSlider.jsx';
import { useImageCropDialog } from './useImageCropDialog.js';
import { useImageCropDraft } from './useImageCropDraft.js';
import { useImageCropTargetWidth } from './useImageCropTargetWidth.js';

export function ImageCropModal({ src, s, set, blockId, onClose }) {
  const { draft, setDraft, resetDraft } = useImageCropDraft(src, s);
  const targetWidth = useImageCropTargetWidth(blockId, src);
  useImageCropDialog(onClose);

  const apply = () => {
    set({
      imageDisplay: 'fill',
      imageHeightPx: Number(draft.height),
      imageX: Number(draft.x),
      imageY: Number(draft.y),
    });
    onClose();
  };

  return createPortal(
    <div className="crop-modal-backdrop" role="dialog" aria-modal="true">
      <div className="crop-modal" style={{ '--crop-target-width': `${targetWidth}px` }}>
        <ImageCropHeader onClose={onClose} />

        {!src ? (
          <ImageCropEmptyState />
        ) : (
          <>
            <ImageCropPreview src={src} draft={draft} setDraft={setDraft} />
            <ImageCropSlider draft={draft} setDraft={setDraft} />
          </>
        )}

        <ImageCropActions disabled={!src} onReset={resetDraft} onCancel={onClose} onApply={apply} />
      </div>
    </div>,
    document.body
  );
}