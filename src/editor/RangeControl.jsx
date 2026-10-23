import { NumberControl } from './ui/NumberControl.jsx';

export function Range({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return <NumberControl className="range" label={label} value={value ?? 0} min={min} max={max} step={step} unit={unit} onChange={onChange} />;
}
