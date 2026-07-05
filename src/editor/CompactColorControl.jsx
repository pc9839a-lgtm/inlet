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