import { Field } from './controls.jsx';
import { TARGET_LABELS } from './targetControlModel.js';

export function TargetUrlField({ value, onChange, mode = 'url' }) {
  if (mode === 'phone') {
    return (
      <Field
        label={TARGET_LABELS.phoneNumber}
        type="tel"
        placeholder="010-0000-0000"
        value={String(value || '').replace(/^tel:/, '')}
        onChange={(number) => onChange(`tel:${number}`)}
      />
    );
  }
  return <Field label={TARGET_LABELS.linkUrl} value={value} onChange={onChange} />;
}
