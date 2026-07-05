import { Choice, Field, Toggle } from '../controls.jsx';
import { customFieldTypes, T } from './reservationEditorModel.js';

export default function ReservationCustomFieldBody({ field, optionDraft, onUpdate, onUpdateOptions }) {
  const updateType = (value) => {
    onUpdate({
      type: value,
      options: value === 'select' ? (field.options?.length ? field.options : [T.option1, T.option2]) : field.options,
    });
  };

  return (
    <div className="mini-body">
      <Field label={T.itemName} value={field.label} onChange={(value) => onUpdate({ label: value })} />
      <Choice
        label={T.inputType}
        value={field.type || 'short'}
        onChange={updateType}
        options={customFieldTypes}
      />
      <Toggle label={T.required} checked={!!field.required} onChange={(value) => onUpdate({ required: value })} />
      {field.type === 'select' && (
        <label className="field field-content">
          <span>{T.options}</span>
          <textarea
            placeholder={T.placeholder}
            value={optionDraft ?? (field.options || []).join(', ')}
            onChange={(event) => onUpdateOptions(event.target.value)}
          />
        </label>
      )}
    </div>
  );
}