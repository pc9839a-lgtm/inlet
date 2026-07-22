export function ImageInputPreview({ label, value, disabled, onEdit, onClear, onRequestEdit }) {
  return (
    <div className={`image-box single-plus ${value ? 'has-image' : 'is-empty'}`}>
      {value ? (
        <>
          <img src={value} alt="" />
          <div className="image-actions">
            <button type="button" disabled={disabled && !onRequestEdit} onClick={disabled ? onRequestEdit : onEdit} title="수정" aria-label={`${label} 수정`}>수정</button>
            <button type="button" disabled={disabled} onClick={onClear} title="삭제" aria-label={`${label} 삭제`}>삭제</button>
          </div>
        </>
      ) : (
        <button type="button" className="image-empty-button" disabled={disabled} onClick={onEdit} title="업로드" aria-label={`${label} 업로드`}>+</button>
      )}
    </div>
  );
}