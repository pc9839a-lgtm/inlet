import { ToggleRow } from '../ui/index.js';
import { T } from './reservationEditorModel.js';

export default function ReservationFixedFields({ required, onRequiredChange }) {
  return (
    <div className="reservation-fixed-fields editor-v2-control-list">
      <ToggleRow label={`1. ${T.name}`} checked={required.name !== false} onChange={(value) => onRequiredChange('name', value)} />
      <ToggleRow label={`2. ${T.phone}`} checked={required.phone !== false} onChange={(value) => onRequiredChange('phone', value)} />
      <div className="reservation-fixed-field is-fixed">
        <strong>3. {T.date}</strong>
        <span>{T.required}</span>
      </div>
      <div className="reservation-fixed-field is-fixed">
        <strong>4. {T.visitTime}</strong>
        <span>{T.required}</span>
      </div>
    </div>
  );
}