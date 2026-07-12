import { Link, TimerReset } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import BottomBarBasicSection from './BottomBarBasicSection.jsx';
import BottomBarTimerSection from './BottomBarTimerSection.jsx';
import { useBottomBarButtons } from './useBottomBarButtons.js';

export default function BottomBarEditor({ s, set, page }) {
  const { count, buttons, updateButton, setCount } = useBottomBarButtons(s, set);

  return (
    <>
      <EditorSection id="content" title="버튼" description="화면 아래에 고정할 버튼을 설정합니다." icon={Link} defaultOpen>
        <BottomBarBasicSection count={count} buttons={buttons} page={page} onCountChange={setCount} onButtonChange={updateButton} />
      </EditorSection>
      <EditorSection id="behavior" title="타이머" description="하단 버튼에 남은 시간을 함께 표시할 수 있습니다." icon={TimerReset}>
        <BottomBarTimerSection enabled={s.timerEnabled} onChange={(timerEnabled) => set({ timerEnabled })} />
      </EditorSection>
    </>
  );
}