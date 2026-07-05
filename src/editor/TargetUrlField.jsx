import { Field } from './controls.jsx';
import { TARGET_LABELS } from './targetControlModel.js';

export function TargetUrlField({ value, onChange }) {
  return <Field label={TARGET_LABELS.linkUrl} value={value} onChange={onChange} />;
}
