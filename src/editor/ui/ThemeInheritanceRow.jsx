import { RotateCcw } from 'lucide-react';

// One explicit source indicator for fields with real renderer-level inheritance.
// Do not imply that every widget style is inherited from the page theme.
export function ThemeInheritanceRow({ label, inherited, color, onReset, inheritedFrom = '전체 디자인', customName = '개별 지정', source = inherited ? 'page' : 'block', stateLabel }) {
  return (
    <div className="editor-theme-source" role="group" aria-label={`${label} 적용 방식`}>
      <div className="editor-theme-source-summary">
        <span className="editor-theme-source-label">{label}</span>
        <span className={`editor-theme-source-state is-${source}`}
          data-style-source={source} aria-live="polite">
          {stateLabel || (source === 'page' ? `${inheritedFrom} 사용` : customName)}
        </span>
      </div>
      <div className="editor-theme-source-detail">
        <span>적용 색상 <code>{color}</code></span>
        {source !== 'page' && (
          <button type="button" onClick={onReset} aria-label={`${label} ${inheritedFrom}으로 되돌리기`}>
            <RotateCcw size={13} aria-hidden="true" /> {inheritedFrom}으로
          </button>
        )}
      </div>
    </div>
  );
}

import { themeAlignmentMode } from './themeInheritanceModel.js';

// Actual renderer rule: page globalAlign wins over s.align when set.
// A block-specific alignment does not override this rule.
export function ThemeAlignmentNotice({ theme }) {
  const mode = themeAlignmentMode(theme);
  if (mode === 'block') return null;
  const label = { left: '왼쪽', center: '가운데', right: '오른쪽' }[mode];
  return (
    <p className="editor-theme-align-notice" data-alignment-source="page">
      전체 디자인의 {label} 정렬이 우선 적용 중입니다. 개별 정렬을 사용하려면 전체 디자인에서 '블록별'을 선택하세요.
    </p>
  );
}
