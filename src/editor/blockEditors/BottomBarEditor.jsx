import { ChevronDown } from 'lucide-react';
import BottomBarBasicSection from './BottomBarBasicSection.jsx';
import BottomBarTimerSection from './BottomBarTimerSection.jsx';
import { useBottomBarButtons } from './useBottomBarButtons.js';
import { BottomBarStylePanel } from './WidgetStylePanels.jsx';

export default function BottomBarEditor({ s, set, page }) {
  const { count, buttons, updateButton, setCount } = useBottomBarButtons(s, set);

  return (
    <div className="bottom-bar-editor-flow">
      <section className="bottom-bar-editor-buttons" aria-label="하단 버튼 편집">
        <BottomBarBasicSection
          count={count}
          buttons={buttons}
          page={page}
          onCountChange={setCount}
          onButtonChange={updateButton}
        />
      </section>
      <details className="bottom-bar-editor-timer">
        <summary>
          <strong>타이머</strong>
          <span className="bottom-bar-editor-status">{s.timerEnabled ? '사용 중' : '사용 안 함'}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="bottom-bar-editor-extra-controls">
          <BottomBarTimerSection enabled={s.timerEnabled} onChange={(timerEnabled) => set({ timerEnabled })} />
        </div>
      </details>
      <details className="bottom-bar-editor-design">
        <summary>
          <strong>디자인</strong>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="bottom-bar-editor-extra-controls">
          <BottomBarStylePanel s={s} set={set} />
        </div>
      </details>
    </div>
  );
}
