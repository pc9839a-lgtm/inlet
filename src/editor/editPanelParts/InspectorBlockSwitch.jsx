import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Moves between existing blocks in page order without changing their order.
export function InspectorBlockSwitch({ navigation }) {
  if (!navigation) return null;
  const { index, total, previousId, nextId, onNavigate } = navigation;
  return (
    <div className="editor-block-switch" role="group" aria-label="블록 간 이동">
      <span className="editor-block-switch-position" aria-live="polite">블록 {index + 1} / {total}</span>
      <div className="editor-block-switch-actions">
        <button type="button" disabled={!previousId} aria-label="이전 블록" onClick={() => onNavigate(previousId)}>
          <ChevronLeft size={15} aria-hidden="true" /><span>이전</span>
        </button>
        <button type="button" disabled={!nextId} aria-label="다음 블록" onClick={() => onNavigate(nextId)}>
          <span>다음</span><ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
