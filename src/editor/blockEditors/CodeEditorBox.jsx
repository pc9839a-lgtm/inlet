export default function CodeEditorBox({ draft, onDraftChange, onOpenModal, onApply }) {
  return (
    <div className="code-editor-box">
      <div className="code-editor-head">
        <strong>코드 입력</strong>
        <button type="button" onClick={onOpenModal}>크게 편집</button>
      </div>
      <textarea
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="HTML 코드를 입력하세요"
        spellCheck={false}
      />
      <div className="code-editor-actions">
        <span>저장하면 위험한 코드는 자동으로 제거됩니다.</span>
        <button type="button" onClick={onApply}>적용</button>
      </div>
    </div>
  );
}