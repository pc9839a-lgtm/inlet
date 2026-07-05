export default function ImageCropActions({ disabled, onReset, onCancel, onApply }) {
  return (
    <div className="crop-actions">
      <button type="button" onClick={onReset}>초기화</button>
      <button type="button" onClick={onCancel}>취소</button>
      <button type="button" className="primary" onClick={onApply} disabled={disabled}>적용</button>
    </div>
  );
}