import { EditorTabs } from '../ui/index.js';
import TimerBasicSection from './TimerBasicSection.jsx';

export default function TimerEditor({ s, set }) {
  return (
    <EditorTabs
      tabs={[
        {
          id: 'content',
          label: '타이머',
          content: <TimerBasicSection s={s} set={set} />,
        },
      ]}
    />
  );
}
