import { Pipette } from 'lucide-react';
import { notify } from '../lib/uiFeedback.js';

export function Color({ label, value, onChange }) {
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
    <label className="color color-clean">
      <span>{label}</span>
      <div className="color-main color-main-v15">
        <input type="color" value={value || '#111827'} onChange={(event) => onChange(event.target.value)} />
        <button type="button" className="eyedropper" onClick={pick} title="미리보기에서 색상 추출" aria-label={`${label} 색상 추출`}>
          <Pipette size={19} />
        </button>
      </div>
    </label>
  );
}