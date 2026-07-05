export function StoredImageCleanup({ summary, mode, onRemoveSingle, onRemoveGallery }) {
  if (!summary.items.length) return null;
  const hasHeavyItems = summary.heavyItems.length > 0;
  return (
    <div className={`image-storage-cleanup ${hasHeavyItems ? 'warning' : ''}`}>
      <div>
        <strong>저장 이미지 용량 {summary.label}</strong>
        <span>{hasHeavyItems ? '큰 이미지는 저장 실패나 느린 복원의 원인이 될 수 있습니다.' : '브라우저 저장 공간에 포함되는 이미지입니다.'}</span>
      </div>
      {hasHeavyItems && (
        <div className="image-storage-actions">
          {mode === 'single' ? (
            <button type="button" onClick={onRemoveSingle}>저장 이미지 제거</button>
          ) : (
            summary.heavyItems.map((item) => (
              <button key={item.index} type="button" onClick={() => onRemoveGallery(item.index)}>
                {item.index + 1}번 제거
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
