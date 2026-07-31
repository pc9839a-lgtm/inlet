export default function GalleryUploadButton({ count, max, disabled, processing, progress = 0, label = '', onClick }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress || 0)));
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-busy={processing || undefined}>
      <span>{processing ? '…' : '＋'}</span>
      <b>{processing ? (label || '이미지 최적화 중') : '여러 장 추가'}</b>
      <small>{processing ? `${safeProgress}%` : `${count}/${max}`}</small>
      {processing && (
        <i className="gallery-upload-progress" aria-hidden="true">
          <em style={{ width: `${safeProgress}%` }} />
        </i>
      )}
    </button>
  );
}
