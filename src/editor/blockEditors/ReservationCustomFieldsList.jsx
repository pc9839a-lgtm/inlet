import { AddButton } from '../controls.jsx';
import ReservationCustomFieldsView from './ReservationCustomFieldsView.jsx';
import { T } from './reservationEditorModel.js';
import { useReservationCustomFields } from './useReservationCustomFields.js';

export default function ReservationCustomFieldsList({ customFields, setCustomFields }) {
  const { addCustom, createFieldProps } = useReservationCustomFields(customFields, setCustomFields);

  return (
    <>
      <div className="reservation-custom-head">
        <strong>{T.addFields}</strong>
        <AddButton onClick={addCustom} />
      </div>

      <ReservationCustomFieldsView customFields={customFields} createFieldProps={createFieldProps} />
    </>
  );
}
