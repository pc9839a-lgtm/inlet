import { EditorTabs } from '../ui/index.js';
import BottomBarBasicSection from './BottomBarBasicSection.jsx';
import BottomBarTimerSection from './BottomBarTimerSection.jsx';
import { useBottomBarButtons } from './useBottomBarButtons.js';
import { BottomBarStylePanel } from './WidgetStylePanels.jsx';

export default function BottomBarEditor({ s, set, page }) {
  const { count, buttons, updateButton, setCount } = useBottomBarButtons(s, set);

  return (
    <EditorTabs
      tabs={[
        {
          id: 'buttons',
          label: '버튼',
          content: <BottomBarBasicSection count={count} buttons={buttons} page={page} onCountChange={setCount} onButtonChange={updateButton} />,
        },
        {
          id: 'timer',
          label: '타이머',
          content: <BottomBarTimerSection enabled={s.timerEnabled} onChange={(timerEnabled) => set({ timerEnabled })} />,
        },
        {
          id: 'style',
          label: '스타일',
          content: <BottomBarStylePanel s={s} set={set} />,
        },
      ]}
    />
  );
}
