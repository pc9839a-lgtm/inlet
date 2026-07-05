import { EditorStack } from '../controls.jsx';
import ScheduleBasicSection from './ScheduleBasicSection.jsx';

export default function ScheduleEditor({ s, set }) {
  return (
    <EditorStack>
      <ScheduleBasicSection s={s} set={set} />
    </EditorStack>
  );
}