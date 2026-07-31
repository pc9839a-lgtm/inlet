import GalleryUploadButton from './GalleryUploadButton.jsx';
import { useGalleryMultiUpload } from './useGalleryMultiUpload.js';

export function GalleryMultiUpload({ count = 0, max = 10, images = [], onAdd }) {
  const { inputRef, remain, pick, uploadState } = useGalleryMultiUpload({ count, max, images, onAdd });
  const processing = uploadState.status === 'processing';

  return (
    <div className={`gallery-multi-upload ${processing ? 'is-processing' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        disabled={processing || remain <= 0}
        onChange={(e) => pick(e.target.files)}
      />
      <GalleryUploadButton
        count={count}
        max={max}
        disabled={processing || remain <= 0}
        processing={processing}
        progress={uploadState.progress}
        label={uploadState.label}
        onClick={() => inputRef.current?.click()}
      />
    </div>
  );
}
