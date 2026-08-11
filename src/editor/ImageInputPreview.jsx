import './ImageInputPreview.css';

function UploadStatus({ label, uploadState }) {
  const processing = uploadState?.status === 'processing';
  const statusVisible = processing || uploadState?.status === 'success' || uploadState?.status === 'error';
  const progress = Math.max(0, Math.min(100, Number(uploadState?.progress || 0)));
  if (!statusVisible) return null;

  return (
    <div
      className={`image-upload-status is-${uploadState.status}`}
      role="status"
      aria-live="polite"
      aria-label={`${label} ${uploadState.label || '이미지 처리 상태'}`}
    >
      <span>{uploadState.label || '이미지 처리 중'}</span>
      {processing && (
        <div className="image-upload-progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function PreviewActions({ label, disabled, onEdit, onClear }) {
  return (
    <div className="image-preview-actions">
      <button type="button" disabled={disabled} onClick={onEdit} aria-label={`${label} 교체`}>교체</button>
      <button type="button" className="danger" disabled={disabled} onClick={onClear} aria-label={`${label} 삭제`}>삭제</button>
    </div>
  );
}

export function ImageInputPreview({ label, value, disabled, uploadState, onEdit, onClear, variant = 'default' }) {
  const processing = uploadState?.status === 'processing';
  const assetVariant = variant === 'favicon' || variant === 'share';
  const modeClass = assetVariant ? `is-${variant}` : 'is-default';

  return (
    <div className={`image-preview-control ${modeClass} ${value ? 'has-image' : 'is-empty'} ${processing ? 'is-processing' : ''}`}>
      <div className="image-preview-frame">
        {value ? (
          <img src={value} alt="" />
        ) : (
          <button
            type="button"
            className="image-preview-empty"
            disabled={disabled}
            onClick={onEdit}
            title="업로드"
            aria-label={`${label} 업로드`}
          >
            +
          </button>
        )}
        <UploadStatus label={label} uploadState={uploadState} />
      </div>
      {value && <PreviewActions label={label} disabled={disabled} onEdit={onEdit} onClear={onClear} />}
    </div>
  );
}
