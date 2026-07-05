import { EditorStack } from '../controls.jsx';
import BottomBarBasicSection from './BottomBarBasicSection.jsx';
import BottomBarTimerSection from './BottomBarTimerSection.jsx';
import { useBottomBarButtons } from './useBottomBarButtons.js';

export default function BottomBarEditor({ s, set, page }) {
  const { count, buttons, updateButton, setCount } = useBottomBarButtons(s, set);

  return (
    <EditorStack>
      <BottomBarBasicSection
        count={count}
        buttons={buttons}
        page={page}
        onCountChange={setCount}
        onButtonChange={updateButton}
      />
      <BottomBarTimerSection enabled={s.timerEnabled} onChange={(timerEnabled) => set({ timerEnabled })} />
    </EditorStack>
  );
}