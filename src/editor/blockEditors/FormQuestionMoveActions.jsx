import { T } from './formEditorModel.js';

export default function FormQuestionMoveActions({ index, total, onMove }) {
  return (
    <div className="form-question-actions">
      <button type="button" onClick={() => onMove(-1)} disabled={index === 0}>{T.up}</button>
      <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}>{T.down}</button>
    </div>
  );
}