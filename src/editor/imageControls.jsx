import { useState } from 'react';
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
import { useEditorMediaLibrary } from './EditorMediaLibraryContext.jsx';
import ImageLibraryPicker from './ImageLibraryPicker.jsx';
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

export function ImageInput({ label, value, onChange, disabled = false, duplicateValues = [], variant = 'default', compact = false }) {
  const storageInfo = storedImageInfo(value);
  const mediaLibrary = useEditorMediaLibrary();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const {
    ref,
    pick,
    openPicker,
    clearImage,
    selectExistingImage,
    uploadState,
  } = useImageInputPicker({ label, value, duplicateValues, onChange, disabled });
  const processing = uploadState.status === 'processing';
  const safeVariant = ['default', 'favicon', 'share'].includes(variant) ? variant : 'default';
  const showStorageNote = safeVariant === 'default' && (!compact || storageInfo.heavy || uploadState.status !== 'idle');
  const canUseLibrary = !!mediaLibrary?.page && !!mediaLibrary?.authUser;

  return (
    <div className={`image-input image-input--${safeVariant} ${compact ? 'image-input--compact' : ''} ${processing ? 'is-processing' : ''}`}>
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
        variant={safeVariant}
        showActions={!compact}
      />
      {compact && <div className="image-input-source-actions">
        <button type="button" className="image-input-upload-action" disabled={disabled || processing} onClick={openPicker}>
          {value ? '사진 바꾸기' : '사진 올리기'}
        </button>
        {canUseLibrary && <button type="button" className="image-input-library-action" disabled={disabled || processing} onClick={() => setLibraryOpen(true)}>내 이미지</button>}
        {value && <button type="button" className="image-input-remove-action" aria-label={`${label} 삭제`} disabled={disabled || processing} onClick={clearImage}>삭제</button>}
      </div>}
      {!compact && canUseLibrary && (
        <button
          type="button"
          className="image-input-library-action"
          disabled={disabled || processing}
          onClick={() => setLibraryOpen(true)}
        >
          내 이미지에서 선택
        </button>
      )}
      {showStorageNote && <ImageStorageNote storageInfo={storageInfo} uploadState={uploadState} />}
      {canUseLibrary && (
        <ImageLibraryPicker
          open={libraryOpen}
          page={mediaLibrary.page}
          authUser={mediaLibrary.authUser}
          currentValue={value}
          label={label}
          onClose={() => setLibraryOpen(false)}
          onSelect={(nextValue) => selectExistingImage(nextValue)}
        />
      )}
    </div>
  );
}
