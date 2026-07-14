import { EditorTabs } from '../ui/index.js';
import ScheduleBasicSection from './ScheduleBasicSection.jsx';
import { ScheduleStylePanel } from './WidgetStylePanels.jsx';

export default function ScheduleEditor({ s, set }) {
  return (
    <EditorTabs
      tabs={[{
        id: 'content',
        label: '내용',
        content: <ScheduleBasicSection s={s} set={set} />,
      },
        {
          id: 'style',
          label: '스타일',
          content: <ScheduleStylePanel s={s} set={set} />,
        }
      ]}
    />
  );
}