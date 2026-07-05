import { Toggle } from '../controls.jsx';
import { T } from './reservationEditorModel.js';

export default function ReservationFixedFields({ required, onRequiredChange }) {
  return (
    <div className="reservation-fixed-fields">
      <div className="reservation-fixed-field">
        <strong>1. {T.name}</strong>
        <Toggle label={T.required} checked={required.name !== false} onChange={(value) => onRequiredChange('name', value)} />
      </div>
      <div className="reservation-fixed-field">
        <strong>2. {T.phone}</strong>
        <Toggle label={T.required} checked={required.phone !== false} onChange={(value) => onRequiredChange('phone', value)} />
      </div>
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