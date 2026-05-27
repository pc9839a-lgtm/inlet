import { Pipette } from 'lucide-react';

export function Color({ label, value, onChange }) {
  return (
    <label className="color-field color-field-clean">
      <span>{label}</span>
      <div>
        <input type="color" value={value || '#111827'} onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={() => onChange('')}>전역</button>
        <Pipette size={14} />
      </div>
    </label>
  );
}

export function Range({ label, value, min = 0, max = 100, onChange }) {
  return (
    <label className="range-field range-field-clean">
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value ?? min} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
