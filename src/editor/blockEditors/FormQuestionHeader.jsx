import { Copy, GripVertical, Trash2 } from 'lucide-react';
import { T, questionTypeLabel } from './formEditorModel.js';

export default function FormQuestionHeader({ question, index, onToggleOpen, onDuplicate, onRemove }) {
  return (
    <div className="form-question-head-row">
      <button type="button" className="drag-handle" title={T.reorder}><GripVertical size={16} /></button>
      <button type="button" className="form-question-title" onClick={onToggleOpen}>
        <span>{index + 1}</span>
        <strong>{question.label || T.item}</strong>
        <em>{question.required ? T.required : T.optional}</em>
        <b>{questionTypeLabel(question.type)}</b>
      </button>
      <button type="button" className="icon-only" onClick={onDuplicate} title={T.copy}><Copy size={15} /></button>
      <button type="button" className="icon-only danger" onClick={onRemove} title={T.remove}><Trash2 size={15} /></button>
    </div>
  );
}