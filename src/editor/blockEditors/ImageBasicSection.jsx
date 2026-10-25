import { ImageInput } from '../controls.jsx';
import { SegmentedControl } from '../ui/index.js';
import ImageGalleryEditor from './ImageGalleryEditor.jsx';
import { StoredImageCleanup } from './StoredImageCleanup.jsx';

export default function ImageBasicSection({
  s,
  set,
  gallery,
  storageSummary,
  updateGallery,
  removeGallery,
  updateSingleImage,
}) {
  const mode = s.mode === 'gallery' ? 'gallery' : 'single';

  return (
    <>
      {mode === 'single' && <ImageInput label="사진" value={s.image} onChange={updateSingleImage} compact />}
      <SegmentedControl
        label="사진 구성"
        value={mode}
        onChange={(value) => set({ mode: value })}
        options={[
          { value: 'single', label: '한 장' },
          { value: 'gallery', label: '여러 장' },
        ]}
      />
      {mode === 'gallery' && <ImageGalleryEditor gallery={gallery} set={set} updateGallery={updateGallery} removeGallery={removeGallery} />}
      {storageSummary.items.length > 0 && <details className="image-editor-storage" open={storageSummary.heavyItems.length > 0}>
        <summary>이미지 용량 {storageSummary.label}</summary>
        <StoredImageCleanup
          summary={storageSummary}
          mode={mode}
          onRemoveSingle={() => updateSingleImage('')}
          onRemoveGallery={removeGallery}
        />
      </details>}
    </>
  );
}
