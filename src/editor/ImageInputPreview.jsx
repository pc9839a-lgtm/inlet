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

export function ImageInputPreview({ label, value, disabled, uploadState, onEdit, onClear, variant = 'default' }) {
  const processing = uploadState?.status === 'processing';
  const assetVariant = variant === 'favicon' || variant === 'share';
  const rootClass = `image-box image-box--${variant} single-plus ${value ? 'has-image' : 'is-empty'} ${processing ? 'is-processing' : ''}`;

  if (assetVariant) {
    return (
      <div className={`${rootClass} settings-asset-control`}>
        <div className="settings-asset-frame">
          {value ? (
            <img src={value} alt="" />
          ) : (
            <button type="button" className="settings-asset-empty" disabled={disabled} onClick={onEdit} title="업로드" aria-label={`${label} 업로드`}>+</button>
          )}
          <UploadStatus label={label} uploadState={uploadState} />
        </div>
        {value && (
          <div className="settings-asset-actions">
            <button type="button" disabled={disabled} onClick={onEdit} aria-label={`${label} 수정`}>교체</button>
            <button type="button" disabled={disabled} onClick={onClear} aria-label={`${label} 삭제`}>삭제</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={rootClass}>
      {value ? (
        <>
          <img src={value} alt="" />
          <div className="image-actions">
            <button type="button" disabled={disabled} onClick={onEdit} title="수정" aria-label={`${label} 수정`}>수정</button>
            <button type="button" disabled={disabled} onClick={onClear} title="삭제" aria-label={`${label} 삭제`}>삭제</button>
          </div>
        </>
      ) : (
        <button type="button" className="image-empty-button" disabled={disabled} onClick={onEdit} title="업로드" aria-label={`${label} 업로드`}>+</button>
      )}
      <UploadStatus label={label} uploadState={uploadState} />
    </div>
  );
}
