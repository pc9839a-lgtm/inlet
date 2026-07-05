import { GripVertical } from 'lucide-react';
import { T } from './reservationEditorModel.js';

export default function ReservationCustomFieldHeader({ index, label, onRemove }) {
  return (
    <div className="form-question-card-head">
      <button type="button" className="drag-handle" title={T.reorder}>
        <GripVertical size={16} />
      </button>
      <strong>{index + 1}. {label || T.newField}</strong>
      <button type="button" className="question-remove" onClick={onRemove}>{T.remove}</button>
    </div>
  );
}