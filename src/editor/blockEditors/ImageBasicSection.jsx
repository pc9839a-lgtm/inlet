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
      <SegmentedControl
        label="이미지 구성"
        value={mode}
        onChange={(value) => set({ mode: value })}
        options={[
          { value: 'single', label: '단일 이미지' },
          { value: 'gallery', label: '갤러리' },
        ]}
      />
      <StoredImageCleanup
        summary={storageSummary}
        mode={mode}
        onRemoveSingle={() => updateSingleImage('')}
        onRemoveGallery={removeGallery}
      />
      {mode === 'gallery' ? (
        <ImageGalleryEditor gallery={gallery} set={set} updateGallery={updateGallery} removeGallery={removeGallery} />
      ) : (
        <ImageInput label="이미지" value={s.image} onChange={updateSingleImage} />
      )}
    </>
  );
}