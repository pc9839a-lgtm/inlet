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
        placeholder="HTML / CSS / JavaScript 코드를 붙여넣으세요"
        spellCheck={false}
      />
      <div className="code-editor-actions">
        <span>HTML·CSS·JavaScript를 격리된 영역에서 실행합니다.</span>
        <button type="button" onClick={onApply}>적용</button>
      </div>
    </div>
  );
}