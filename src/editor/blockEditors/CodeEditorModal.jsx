export default function CodeEditorModal({ draft, onDraftChange, onClose, onApply }) {
  return (
    <div className="code-editor-modal" role="dialog" aria-modal="true">
      <div className="code-editor-modal-card">
        <div className="code-editor-modal-head">
          <strong>코드 편집</strong>
          <button type="button" onClick={onClose}>닫기</button>
        </div>
        <textarea
          wrap="soft"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="HTML 코드를 입력하세요"
          spellCheck={false}
          autoFocus
        />
        <div className="code-editor-modal-actions">
          <span>저장하면 위험한 코드는 자동으로 제거됩니다.</span>
          <button type="button" onClick={onApply}>적용</button>
        </div>
      </div>
    </div>
  );
}