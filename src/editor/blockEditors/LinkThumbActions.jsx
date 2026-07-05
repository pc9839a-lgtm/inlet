export default function LinkThumbActions({ hasThumb, loading, onAuto, onUpload, onDelete }) {
  return (
    <div className="thumb-actions">
      <button type="button" onClick={onAuto} disabled={loading}>{loading ? '확인 중' : '자동'}</button>
      <button type="button" onClick={onUpload}>업로드</button>
      {hasThumb && (
        <button type="button" className="ghost thumb-delete-action" onClick={onDelete}>썸네일 삭제</button>
      )}
    </div>
  );
}