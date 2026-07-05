import ReservationCustomFieldCard from './ReservationCustomFieldCard.jsx';
import { T } from './reservationEditorModel.js';

export default function ReservationCustomFieldsView({ customFields, createFieldProps }) {
  return (
    <div className="form-question-list reservation-custom-list">
      {customFields.length === 0 && <div className="empty">{T.noFields}</div>}
      {customFields.map((field, index) => (
        <ReservationCustomFieldCard
          key={field.id}
          field={field}
          index={index}
          {...createFieldProps(field)}
        />
      ))}
    </div>
  );
}
