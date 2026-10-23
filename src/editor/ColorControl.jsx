import { useEffect, useState } from 'react';
import { Pipette } from 'lucide-react';
import { notify } from '../lib/uiFeedback.js';
import './ColorControl.css';

export function Color({ label, value, onChange }) {
  const color = /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#111827';
  const [draft, setDraft] = useState(color);
  useEffect(() => setDraft(color), [color]);
  const finish = () => {
    const raw = draft.trim();
    const normalized = /^#[0-9a-f]{3}$/i.test(raw) ? `#${raw.slice(1).split('').map((part) => part + part).join('')}` : raw;
    if (/^#[0-9a-f]{6}$/i.test(normalized)) {
      setDraft(normalized.toUpperCase());
      if (normalized.toLowerCase() !== color.toLowerCase()) onChange(normalized);
    } else setDraft(color);
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
      // User cancelled the eyedropper.
    }
  };

  return (
    <div className="color color-clean">
      <span>{label}</span>
      <div className="color-main color-main-v15">
        <input type="color" aria-label={label} value={color} onChange={(event) => onChange(event.target.value)} />
        <input type="text" aria-label={`${label} HEX`} value={draft} spellCheck={false} maxLength={7} onChange={(event) => setDraft(event.target.value)} onBlur={finish} onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
          if (event.key === 'Escape') { event.preventDefault(); setDraft(color); }
        }} />
        <button type="button" className="eyedropper" onClick={pick} title="미리보기에서 색상 추출" aria-label={`${label} 색상 추출`}>
          <Pipette size={19} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
