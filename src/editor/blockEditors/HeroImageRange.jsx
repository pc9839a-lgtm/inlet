import { useEffect, useState } from 'react';

export default function HeroImageRange({ Range, label, unit, value, min, max, onChange }) {
  const clamp = (number) => Math.max(min, Math.min(max, Math.round(number)));
  const current = Number.isFinite(Number(value)) ? clamp(Number(value)) : min;
  const [draft, setDraft] = useState(String(current));

  useEffect(() => setDraft(String(current)), [current]);

  const finish = () => {
    const number = draft.trim() === '' ? current : Number(draft);
    const next = Number.isFinite(number) ? clamp(number) : current;
    setDraft(String(next));
    if (next !== current) onChange(next);
  };

  return (
    <div className="hero-image-range">
      <Range label={label} value={current} min={min} max={max} onChange={(next) => onChange(clamp(Number(next)))} />
      <div className="hero-image-number">
        <input
          type="number"
          aria-label={`${label} (${unit})`}
          min={min}
          max={max}
          step={1}
          value={draft}
          onChange={(event) => {
            const raw = event.target.value;
            setDraft(raw);
            const number = Number(raw);
            if (raw.trim() !== '' && Number.isFinite(number) && number >= min && number <= max) {
              const next = clamp(number);
              if (next !== current) onChange(next);
            }
          }}
          onBlur={finish}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        <span aria-hidden="true">{unit}</span>
      </div>
    </div>
  );
}
