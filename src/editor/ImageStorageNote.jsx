export function ImageStorageNote({ storageInfo }) {
  if (!storageInfo.stored) return null;

  return (
    <small className={`image-storage-note ${storageInfo.heavy ? 'warning' : ''}`}>
      저장 이미지 {storageInfo.label}{storageInfo.heavy ? ' · 용량 큼' : ''}
    </small>
  );
}