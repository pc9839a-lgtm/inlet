import ReservationCustomFieldsList from './ReservationCustomFieldsList.jsx';
import ReservationFixedFields from './ReservationFixedFields.jsx';

export function ReservationFieldsSection({ s, set }) {
  const customFields = Array.isArray(s.customFields) ? s.customFields : [];
  const required = { name: true, phone: true, ...(s.required || {}) };

  const setRequired = (key, value) => {
    set({ required: { ...required, [key]: value } });
  };

  const setCustomFields = (nextCustomFields) => {
    set({ customFields: nextCustomFields });
  };

  return (
    <>
      <ReservationFixedFields required={required} onRequiredChange={setRequired} />
      <ReservationCustomFieldsList customFields={customFields} setCustomFields={setCustomFields} />
    </>
  );
}