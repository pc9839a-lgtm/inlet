import { EditorField, SegmentedControl, ToggleRow } from '../ui/index.js';
import { customFieldTypes, T } from './reservationEditorModel.js';

export default function ReservationCustomFieldBody({ field, optionDraft, onUpdate, onUpdateOptions }) {
  const updateType = (value) => {
    onUpdate({
      type: value,
      options: value === 'select' ? (field.options?.length ? field.options : [T.option1, T.option2]) : field.options,
    });
  };

  return (
    <div className="form-question-body reservation-custom-body">
      <EditorField label={T.itemName}>
        <input value={field.label} onChange={(event) => onUpdate({ label: event.target.value })} />
      </EditorField>
      <SegmentedControl
        label={T.inputType}
        value={field.type || 'short'}
        onChange={updateType}
        options={customFieldTypes.map(([value, label]) => ({ value, label }))}
      />
      <ToggleRow label={T.required} checked={!!field.required} onChange={(value) => onUpdate({ required: value })} />
      {field.type === 'select' && (
        <EditorField label={T.options}>
          <textarea
            placeholder={T.placeholder}
            value={optionDraft ?? (field.options || []).join(', ')}
            onChange={(event) => onUpdateOptions(event.target.value)}
          />
        </EditorField>
      )}
    </div>
  );
}
