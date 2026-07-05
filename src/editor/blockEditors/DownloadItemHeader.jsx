export default function DownloadItemHeader({ index, canRemove, onRemove }) {
  return (
    <div className="download-simple-head">
      <strong>파일 {index + 1}</strong>
      <button type="button" onClick={onRemove} disabled={!canRemove}>삭제</button>
    </div>
  );
}