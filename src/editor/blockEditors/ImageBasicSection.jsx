import { Choice, ImageInput, Step } from '../controls.jsx';
import ImageDisplayControls from './ImageDisplayControls.jsx';
import ImageGalleryEditor from './ImageGalleryEditor.jsx';
import { StoredImageCleanup } from './StoredImageCleanup.jsx';

export default function ImageBasicSection({
  s,
  set,
  block,
  gallery,
  display,
  editSrc,
  storageSummary,
  cropOpen,
  setCropOpen,
  updateGallery,
  removeGallery,
  updateSingleImage,
  changeDisplay,
}) {
  return (
    <Step title="기본" icon="1" open>
      <Choice label="표시" value={s.mode} onChange={(value) => set({ mode: value })} options={[["single", "단일"], ["gallery", "갤러리"]]} />
      <StoredImageCleanup
        summary={storageSummary}
        mode={s.mode}
        onRemoveSingle={() => updateSingleImage('')}
        onRemoveGallery={removeGallery}
      />
      {s.mode === 'gallery' ? (
        <ImageGalleryEditor gallery={gallery} set={set} updateGallery={updateGallery} removeGallery={removeGallery} />
      ) : (
        <ImageInput label="이미지" value={s.image} onChange={updateSingleImage} />
      )}
      <ImageDisplayControls
        display={display}
        s={s}
        set={set}
        editSrc={editSrc}
        blockId={block?.id}
        cropOpen={cropOpen}
        setCropOpen={setCropOpen}
        changeDisplay={changeDisplay}
      />
    </Step>
  );
}