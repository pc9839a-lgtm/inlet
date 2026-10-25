export default function CodeEditorBox({ draft, onDraftChange, onOpenModal, onApply, codePending, codeDraftHint }) {
  return (
    <div className="code-editor-box">
      <div className="code-editor-head">
        <button type="button" onClick={onOpenModal}>크게 편집</button>
      </div>
      <textarea
        aria-label="HTML 코드 초안"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="HTML / CSS / JavaScript 코드를 붙여넣으세요"
        spellCheck={false}
      />
      <div className="code-editor-actions">
        <span role="status" aria-live="polite" data-code-draft-state={codePending ? 'pending' : 'applied'}>{codeDraftHint}</span>
        <button type="button" onClick={onApply}>적용</button>
      </div>
    </div>
  );
}