import { ChevronDown } from 'lucide-react';
import { InspectorDisclosure } from '../ui/InspectorDisclosure.jsx';
import BottomBarBasicSection from './BottomBarBasicSection.jsx';
import BottomBarTimerSection from './BottomBarTimerSection.jsx';
import { useBottomBarButtons } from './useBottomBarButtons.js';
import { BottomBarStylePanel } from './WidgetStylePanels.jsx';

export default function BottomBarEditor({ s, set, page }) {
  const { count, buttons, updateButton, setCount } = useBottomBarButtons(s, set);

  return (
    <div className="bottom-bar-editor-flow editor-task-flow" data-editor-task="bottom-buttons">
      <section className="bottom-bar-editor-buttons editor-task-section" aria-label="하단 버튼 편집">
        <div className="editor-task-heading"><h3>버튼 문구와 연결</h3></div>
        <BottomBarBasicSection
          count={count}
          buttons={buttons}
          page={page}
          onCountChange={setCount}
          onButtonChange={updateButton}
        />
      </section>
      <section className="editor-task-section editor-task-secondary" aria-label="하단 버튼 추가 설정">
      <div className="editor-task-heading"><h3>추가 설정</h3></div>
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
      <InspectorDisclosure label="디자인" className="bottom-bar-editor-design" bodyClassName="bottom-bar-editor-extra-controls">
        <BottomBarStylePanel s={s} set={set} theme={page?.theme} />
      </InspectorDisclosure>
      </section>
    </div>
  );
}
