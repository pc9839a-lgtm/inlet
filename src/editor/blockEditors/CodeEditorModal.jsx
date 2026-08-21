export default function CodeEditorModal({ draft, onDraftChange, onClose, onApply }) {
  return (
    <div className="code-editor-modal" role="dialog" aria-modal="true">
      <div className="code-editor-modal-card">
        <div className="code-editor-modal-head">
          <strong>코드 편집</strong>
          <button type="button" onClick={onClose}>닫기</button>
        </div>
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="HTML / CSS / JavaScript 코드를 붙여넣으세요"
          spellCheck={false}
          autoFocus
        />
        <div className="code-editor-modal-actions">
          <span>HTML·CSS·JavaScript를 격리된 영역에서 실행합니다.</span>
          <button type="button" onClick={onApply}>적용</button>
        </div>
      </div>
    </div>
  );
}