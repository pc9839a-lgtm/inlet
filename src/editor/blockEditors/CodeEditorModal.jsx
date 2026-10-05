import { useAccessibleDialog } from '../../lib/useAccessibleDialog.js';

export default function CodeEditorModal({ draft, onDraftChange, onClose, onApply }) {
  const dialogRef = useAccessibleDialog(onClose, { lockScroll: true });

  return (
    <div className="code-editor-modal" role="presentation">
      <div
        ref={dialogRef}
        className="code-editor-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="code-editor-modal-title"
        tabIndex={-1}
      >
        <div className="code-editor-modal-head">
          <strong id="code-editor-modal-title">코드 편집</strong>
          <button type="button" onClick={onClose}>닫기</button>
        </div>
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="HTML / CSS / JavaScript 코드를 붙여넣으세요"
          spellCheck={false}
        />
        <div className="code-editor-modal-actions">
          <span>HTML·CSS·JavaScript를 격리된 영역에서 실행합니다.</span>
          <button type="button" onClick={onApply}>적용</button>
        </div>
      </div>
    </div>
  );
}
