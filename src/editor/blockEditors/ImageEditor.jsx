import { ChevronDown } from 'lucide-react';
import { ToggleRow } from '../ui/index.js';
import ImageBasicSection from './ImageBasicSection.jsx';
import ImageCaptionSection from './ImageCaptionSection.jsx';
import ImageDisplayControls from './ImageDisplayControls.jsx';
import ImageGalleryDisplaySection from './ImageGalleryDisplaySection.jsx';
import useImageEditorState from './useImageEditorState.js';
import { WidgetSpacingControls } from './WidgetSpacingControls.jsx';
import './ImageEditor.css';

export default function ImageEditor({ s, set, block }) {
  const imageState = useImageEditorState({ s, set });
  const gridGallery = s.mode === 'gallery' && s.galleryLayout === 'grid';

  return (
    <div className="image-editor-flow">
      <ImageBasicSection
        s={s}
        set={set}
        gallery={imageState.gallery}
        storageSummary={imageState.storageSummary}
        updateGallery={imageState.updateGallery}
        removeGallery={imageState.removeGallery}
        updateSingleImage={imageState.updateSingleImage}
      />
      {!gridGallery && <ImageDisplayControls
        display={imageState.display}
        s={s}
        set={set}
        editSrc={imageState.editSrc}
        blockId={block?.id}
        cropOpen={imageState.cropOpen}
        setCropOpen={imageState.setCropOpen}
        changeDisplay={imageState.changeDisplay}
      />}
      <details className="image-editor-more">
        <summary>추가 설정<ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="image-editor-more-controls">
          <ImageCaptionSection s={s} set={set} />
          <ToggleRow label="모서리 둥글게" checked={Boolean(s.rounded)} onChange={(value) => set({ rounded: value })} />
          <ImageGalleryDisplaySection s={s} set={set} />
        </div>
      </details>
      <WidgetSpacingControls s={s} set={set} padding={false} defaultMargin={12} />
    </div>
  );
}
