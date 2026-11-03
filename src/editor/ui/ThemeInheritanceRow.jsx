import { RotateCcw } from 'lucide-react';

// One explicit source indicator for fields with real renderer-level inheritance.
// Do not imply that every widget style is inherited from the page theme.
export function ThemeInheritanceRow({ label, inherited, color, onReset, inheritedFrom = '전체 디자인', customName = '개별 지정' }) {
  return (
    <div className="editor-theme-source" role="group" aria-label={`${label} 적용 방식`}>
      <div className="editor-theme-source-summary">
        <span className="editor-theme-source-label">{label}</span>
        <span className={`editor-theme-source-state${inherited ? ' is-inherited' : ' is-custom'}`}
          data-style-source={inherited ? 'page' : 'block'} aria-live="polite">
          {inherited ? `${inheritedFrom} 사용` : customName}
        </span>
      </div>
      <div className="editor-theme-source-detail">
        <span>적용 색상 <code>{color}</code></span>
        {!inherited && (
          <button type="button" onClick={onReset} aria-label={`${label} ${inheritedFrom}으로 되돌리기`}>
            <RotateCcw size={13} aria-hidden="true" /> {inheritedFrom}으로
          </button>
        )}
      </div>
    </div>
  );
}
