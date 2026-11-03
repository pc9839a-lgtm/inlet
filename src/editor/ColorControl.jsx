import { useEffect, useId, useState } from 'react';
import { Pipette } from 'lucide-react';
import { notify } from '../lib/uiFeedback.js';
import './ColorControl.css';

// Accept pasted HEX with or without #, including the three-digit shorthand.
// The editor model still receives only canonical six-digit HEX values.
export function normalizeEditorHex(value) {
  const raw = String(value ?? '').trim().replace(/^#/, '');
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return null;
  const full = raw.length === 3 ? [...raw].map((part) => part + part).join('') : raw;
  return `#${full.toUpperCase()}`;
}

export function Color({ label, value, onChange }) {
  const color = normalizeEditorHex(value) || '#111827';
  const errorId = useId();
  const [draft, setDraft] = useState(color);
  const [error, setError] = useState('');
  useEffect(() => {
    setDraft(color);
    setError('');
  }, [color]);

  const finish = () => {
    const normalized = normalizeEditorHex(draft);
    if (!normalized) {
      // Do not silently discard the entered value or update the page draft.
      setError('HEX 색상은 3자리 또는 6자리의 16진수로 입력하세요.');
      return;
    }
    setError('');
    setDraft(normalized);
    if (normalized.toLowerCase() !== color.toLowerCase()) onChange(normalized);
  };

  const pick = async () => {
    if (typeof window === 'undefined' || !window.EyeDropper) {
      notify('이 브라우저에서는 스포이드 기능을 지원하지 않습니다. Chrome 또는 Edge 최신 버전에서 사용해주세요.', 'error');
      return;
    }
    try {
      const result = await new window.EyeDropper().open();
      if (result?.sRGBHex) onChange(result.sRGBHex);
    } catch (error) {
      // User cancelled the eyedropper; keep the previous valid color.
    }
  };

  return (
    <div className="color color-clean">
      <span>{label}</span>
      <div className="color-main color-main-v15">
        <input type="color" aria-label={label} value={color} onChange={(event) => onChange(event.target.value)} />
        <input
          type="text"
          aria-label={`${label} HEX`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={draft}
          placeholder="#RRGGBB"
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError('');
          }}
          onBlur={finish}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(color);
              setError('');
            }
          }}
        />
        <button type="button" className="eyedropper" onClick={pick} title="미리보기에서 색상 추출" aria-label={`${label} 색상 추출`}>
          <Pipette size={19} aria-hidden="true" />
        </button>
      </div>
      {error && <p className="color-hex-error" id={errorId} role="alert">{error}</p>}
    </div>
  );
}
