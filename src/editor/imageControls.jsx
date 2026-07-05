import {
  IMAGE_UPLOAD_BATCH_WARN_BYTES,
  IMAGE_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_WARN_BYTES,
  estimateImageStorageBytes,
  formatFileSize,
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
  IMAGE_UPLOAD_WARN_BYTES,
  estimateImageStorageBytes,
  formatFileSize,
  imageUploadError,
  storedImageInfo,
  storedImagesSummary,
  warnImageStorageUse,
};

export function ImageInput({ label, value, onChange, disabled = false }) {
  const storageInfo = storedImageInfo(value);
  const { ref, pick, openPicker, clearImage } = useImageInputPicker({ label, onChange, disabled });

  return (
    <div className="image-input">
      <span>{label}</span>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(event) => pick(event.target.files?.[0])} />
      <ImageInputPreview
        label={label}
        value={value}
        disabled={disabled}
        onEdit={openPicker}
        onClear={clearImage}
      />
      <ImageStorageNote storageInfo={storageInfo} />
    </div>
  );
}