export default function LinkThumbStorageNotice({ storage, onClear }) {
  if (!storage?.stored) return null;

  return (
    <div className={`image-storage-cleanup compact ${storage.heavy ? 'warning' : ''}`}>
      <span>저장된 썸네일 {storage.label}{storage.heavy ? ' · 용량 큼' : ''}</span>
      {storage.heavy && (
        <button type="button" onClick={onClear}>썸네일 제거</button>
      )}
    </div>
  );
}