import { ChevronDown, GripVertical, Trash2 } from 'lucide-react';
import { customFieldTypes, T } from './reservationEditorModel.js';

export default function ReservationCustomFieldHeader({ field, index, isOpen, onToggleOpen, onRemove }) {
  const typeLabel = customFieldTypes.find(([value]) => value === (field.type || 'short'))?.[1] || T.short;

  return (
    <div className="form-question-head-row reservation-custom-head-row">
      <button type="button" className="drag-handle" title={T.reorder}>
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <button type="button" className="form-question-title" aria-expanded={isOpen} onClick={onToggleOpen}>
        <span>{index + 1}</span>
        <strong>{field.label || T.newField}</strong>
        <em>{field.required ? T.required : '선택'}</em>
        <b>{typeLabel}</b>
        <ChevronDown className="form-question-chevron" size={17} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-only danger"
        aria-label={`${field.label || T.newField} ${T.remove}`}
        title={T.remove}
        onClick={onRemove}
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
