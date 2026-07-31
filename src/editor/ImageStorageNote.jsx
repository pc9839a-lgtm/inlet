export function ImageStorageNote({ storageInfo, uploadState }) {
  if (uploadState?.status === 'processing') {
    return <small className="image-storage-note processing">원본을 브라우저에서 최적화하고 있습니다.</small>;
  }
  if (uploadState?.status === 'error') {
    return <small className="image-storage-note error">{uploadState.label}</small>;
  }
  if (uploadState?.status === 'success' && uploadState.label) {
    return <small className="image-storage-note success">{uploadState.label}</small>;
  }
  if (!storageInfo.stored) return <small className="image-storage-note">JPG·PNG·WebP는 최대 1920px로 자동 최적화됩니다.</small>;

  return (
    <small className={`image-storage-note ${storageInfo.heavy ? 'warning' : ''}`}>
      저장 이미지 {storageInfo.label}{storageInfo.heavy ? ' · 용량 큼' : ''}
    </small>
  );
}
