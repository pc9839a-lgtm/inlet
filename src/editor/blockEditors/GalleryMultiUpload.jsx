import GalleryUploadButton from './GalleryUploadButton.jsx';
import { useGalleryMultiUpload } from './useGalleryMultiUpload.js';

export function GalleryMultiUpload({ count = 0, max = 10, onAdd }) {
  const { inputRef, remain, pick } = useGalleryMultiUpload({ count, max, onAdd });

  return (
    <div className="gallery-multi-upload">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => pick(e.target.files)}
      />
      <GalleryUploadButton count={count} max={max} disabled={remain <= 0} onClick={() => inputRef.current?.click()} />
    </div>
  );
}