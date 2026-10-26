import { T } from './formEditorModel.js';

export default function FormQuestionMoveActions({ index, total, onMove, onDuplicate, onRemove }) {
  return (
    <div className="form-question-actions">
      <button type="button" onClick={() => onMove(-1)} disabled={index === 0}>{T.up}</button>
      <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}>{T.down}</button>
      <button type="button" onClick={onDuplicate}>{T.copy}</button>
      <button type="button" className="danger" onClick={onRemove}>{T.remove}</button>
    </div>
  );
}
