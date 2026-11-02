import { useEffect, useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import './NumberControl.css';

export function NumberControl({ label, value, min = 0, max = 100, step = 1, unit = '', onChange, presets = [], slider = true, steppers = false, className = '', valueClassName = '' }) {
  const id = useId();
  const clamp = (number) => Math.max(min, Math.min(max, number));
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
    <div className={`editor-number-control ${className}`.trim()} data-slider={slider} data-steppers={steppers}>
      <label htmlFor={`editor-number-${id}`}>{label}</label>
      <div className="editor-number-inputs">
        {slider && <input type="range" aria-label={`${label} 슬라이더`} min={min} max={max} step={step} value={current} onChange={(event) => onChange(Number(event.target.value))} />}
        <span className={`editor-number-value ${valueClassName}`.trim()}>
          <input id={`editor-number-${id}`} type="number" aria-label={unit ? `${label} (${unit})` : `${label} 값`} min={min} max={max} step={step} value={draft}
            onChange={(event) => {
              const raw = event.target.value;
              setDraft(raw);
              const number = Number(raw);
              if (raw.trim() !== '' && Number.isFinite(number) && number >= min && number <= max && number !== current) onChange(number);
            }}
            onBlur={finish}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
              if (event.key === 'Escape') { event.preventDefault(); setDraft(String(current)); }
            }} />
          {unit && <span aria-hidden="true">{unit}</span>}
        </span>
        {steppers && <span className="editor-number-steppers">
          <button type="button" aria-label={`${label} 줄이기`} disabled={current <= min} onClick={() => { const next = clamp(current - step); setDraft(String(next)); onChange(next); }}><Minus size={16} aria-hidden="true" /></button>
          <button type="button" aria-label={`${label} 늘리기`} disabled={current >= max} onClick={() => { const next = clamp(current + step); setDraft(String(next)); onChange(next); }}><Plus size={16} aria-hidden="true" /></button>
        </span>}
      </div>
      {presets.length > 0 && <div className="editor-number-presets" role="group" aria-label={`${label} 빠른 선택`}>
        {presets.filter((preset) => preset >= min && preset <= max).map((preset) => <button type="button" key={preset} aria-pressed={current === preset} onClick={() => { setDraft(String(preset)); onChange(preset); }}>{preset}{unit}</button>)}
      </div>}
    </div>
  );
}
