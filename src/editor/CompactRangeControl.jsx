import { NumberControl } from './ui/NumberControl.jsx';

export function Range({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return <NumberControl className="range-field range-field-clean" label={label} value={value ?? min} min={min} max={max} step={step} unit={unit} onChange={onChange} />;
}
