import { createPortal } from 'react-dom';
import { useAccessibleDialog } from '../../lib/useAccessibleDialog.js';

export default function CodeEditorModal({ draft, onDraftChange, onClose, onApply, codePending, codeDraftHint }) {
  const dialogRef = useAccessibleDialog(onClose, { lockScroll: true });

  return typeof document !== 'undefined' ? createPortal(
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
          aria-label="HTML 코드 초안"
        value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="HTML / CSS / JavaScript 코드를 붙여넣으세요"
          spellCheck={false}
        />
        <div className="code-editor-modal-actions">
          <span data-code-draft-state={codePending ? 'pending' : 'applied'}>{codeDraftHint}</span>
          <button type="button" onClick={onApply}>적용</button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;
}
