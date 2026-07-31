import {
  IMAGE_UPLOAD_BATCH_WARN_BYTES,
  IMAGE_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_MAX_DIMENSION,
  IMAGE_UPLOAD_SOURCE_MAX_BYTES,
  IMAGE_UPLOAD_WARN_BYTES,
  estimateImageStorageBytes,
  formatFileSize,
  imageDataFingerprint,
  imageUploadError,
  storedImageInfo,
  storedImagesSummary,
  warnImageStorageUse,
} from './imageControlModel.js';
import { ImageInputPreview } from './ImageInputPreview.jsx';
import { ImageStorageNote } from './ImageStorageNote.jsx';
import { useImageInputPicker } from './useImageInputPicker.js';

export {
  IMAGE_UPLOAD_BATCH_WARN_BYTES,
  IMAGE_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_MAX_DIMENSION,
  IMAGE_UPLOAD_SOURCE_MAX_BYTES,
  IMAGE_UPLOAD_WARN_BYTES,
  estimateImageStorageBytes,
  formatFileSize,
  imageDataFingerprint,
  imageUploadError,
  storedImageInfo,
  storedImagesSummary,
  warnImageStorageUse,
};

export function ImageInput({ label, value, onChange, disabled = false, duplicateValues = [] }) {
  const storageInfo = storedImageInfo(value);
  const {
    ref,
    pick,
    openPicker,
    clearImage,
    uploadState,
  } = useImageInputPicker({ label, value, duplicateValues, onChange, disabled });
  const processing = uploadState.status === 'processing';

  return (
    <div className={`image-input ${processing ? 'is-processing' : ''}`}>
      <span>{label}</span>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        disabled={disabled || processing}
        onChange={(event) => pick(event.target.files?.[0])}
      />
      <ImageInputPreview
        label={label}
        value={value}
        disabled={disabled || processing}
        uploadState={uploadState}
        onEdit={openPicker}
        onClear={clearImage}
      />
      <ImageStorageNote storageInfo={storageInfo} uploadState={uploadState} />
    </div>
  );
}
