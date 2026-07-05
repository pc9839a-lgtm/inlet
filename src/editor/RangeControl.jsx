export function Range({ label, value, min = 0, max = 100, onChange }) {
  return (
    <label className="range">
      <span>{label}</span>
      <div>
        <input type="range" min={min} max={max} value={value ?? 0} onChange={(event) => onChange(event.target.value)} />
        <b>{value ?? 0}</b>
      </div>
    </label>
  );
}