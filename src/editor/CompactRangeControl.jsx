export function Range({ label, value, min = 0, max = 100, onChange }) {
  return (
    <label className="range-field range-field-clean">
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value ?? min} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}