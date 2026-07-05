import { EditorStack } from '../controls.jsx';
import TimerBasicSection from './TimerBasicSection.jsx';
import TimerCtaTargetSection from './TimerCtaTargetSection.jsx';
import TimerFloatingCtaSection from './TimerFloatingCtaSection.jsx';

export default function TimerEditor({ s, set, page, TargetControl }) {
  return (
    <EditorStack>
      <TimerBasicSection s={s} set={set} />
      <TimerFloatingCtaSection s={s} set={set} />
      <TimerCtaTargetSection s={s} set={set} page={page} TargetControl={TargetControl} />
    </EditorStack>
  );
}
