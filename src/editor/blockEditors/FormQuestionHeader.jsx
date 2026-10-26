import { ChevronDown, GripVertical } from 'lucide-react';
import { T, questionTypeLabel } from './formEditorModel.js';

export default function FormQuestionHeader({ question, index, isOpen, onToggleOpen, onDragStart }) {
  return (
    <div className="form-question-head-row">
      <button type="button" className="drag-handle" draggable onDragStart={onDragStart} aria-label={`${question.label || T.item} ${T.reorder}`} title={T.reorder}><GripVertical size={16} aria-hidden="true" /></button>
      <button type="button" className="form-question-title" aria-expanded={isOpen} aria-controls={isOpen ? `form-question-body-${question.id}` : undefined} onClick={onToggleOpen}>
        <span className="form-question-number">{index + 1}</span>
        <span className="form-question-identity"><strong>{question.label || T.item}</strong><small>{questionTypeLabel(question.type)}{question.required ? ` · ${T.required}` : ''}</small></span>
        <ChevronDown className="form-question-chevron" size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
